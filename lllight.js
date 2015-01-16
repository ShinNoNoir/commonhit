/* LikeLines "Light": Basically, just a way of recording interactions into a form */
LLL = {
	DEFAULT_WIDTH: 425, // 640
	DEFAULT_HEIGHT: 340,

	CSS_CLASSES: ["lll-player"],

	
	_creationQueue: [],
	_ytReady: false
};

(function (LLL, $) {
	LLL._creationQueue = [];
	
	LLL.loadYouTubeAPI = function() {
		var tag = document.createElement('script');
		tag.src = "//www.youtube.com/iframe_api";
		var firstScriptTag = document.getElementsByTagName('script')[0];
		firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
	}
	
	LLL.onYouTubeIframeAPIReady = function() { 
		LLL._ytReady = true;
		
		for(var i=0, n=LLL._creationQueue.length; i < n; i++) {
			LLL._creationQueue[i]();
		}
		LLL._creationQueue = [];
	};
	
	
	LLL.injectPlayersIntoDOM = function () {
		var exec = function () {
			$('.lll-player:not(iframe)').each(function() {
				var $player = $(this);
				var id = this.id;
				var video_id = $player.data('video-id');
				var log_field = $player.data('log-field');
				var width = $player.data('width');
				var height = $player.data('height');
				
				var exposed_name = $player.data('name');
				
				var lllplayer = new LLL.Player(id, video_id, log_field, width, height);
				
				if (exposed_name !== undefined) {
					window[exposed_name] = lllplayer;
				}
			});
		};
		if (LLL._ytReady) {
			exec();
		}
		else {
			LLL._creationQueue.push(exec);
		}
	};
	
	LLL.Player = function(player_id, video_id, log_field, width, height) {
		this.player_id = player_id;
		this.video_id = video_id;
		
		this.log_field_name = log_field;
		this.$log_field = undefined; // set/created when ready
		this.eventlog = [];
		this.eventlog_serialized_prefix = ''; // everything except the last two events
		this.eventlog_serialized_prefix_length = 0;
		
		this.width = width || LLL.DEFAULT_WIDTH;
		this.height = height || LLL.DEFAULT_HEIGHT;
		
		this.ticker = undefined;
		this.lastTickTC = 0;
		
		this.ready = false;
		this.ytstate = undefined;
		
		var self = this;
		this.ytplayer = undefined;
		if (LLL._ytReady) {
			self.createYTPlayer();
		}
		else {
			LLL._creationQueue.push(function () {
				self.createYTPlayer();
			});
		}
	};
	
	LLL.Player.prototype.createYTPlayer = function () {
		var self = this;
		self.ytplayer = new YT.Player(this.player_id, {
			height: this.height,
			width: this.width,
			videoId: this.video_id,
			playerVars: {
				version: 3,
				rel: 0,
				html5: 1,
				showinfo: 1
			},
			events: {
				'onReady': function () { self.onYouTubePlayerReady(); }
			}
		});
	};
	
	LLL.Player.prototype.onYouTubePlayerReady = function() {
		var self = this;
		self.ready = true;
		// workaround for https://code.google.com/p/gdata-issues/issues/detail?id=4706
		self.ytplayer.addEventListener('onStateChange', function (evt) { self.onPlayerStateChange(evt); });
		self.onPlayerStateChange( {'data': -1} );
		
		if (this.log_field_name !== undefined) {
			var $node = $('<input type="hidden">').attr('name', this.log_field_name);
			$node.insertAfter(this.ytplayer.getIframe());
			this.$log_field = $node;
		}
	};
	LLL.Player.prototype.onPlayerStateChange = function(evt) {
		var evtType = {
			 0: 'ENDED',
			 1: 'PLAYING',
			 2: 'PAUSED'
		}[evt.data];
		
		this.ytstate = evt.data;
		
		if (evtType !== undefined) {
			this._setTicker();
			this.onPlaybackEvent(evtType);
		}
	};
	
	LLL.Player.prototype._setTicker = function() {
		if (this.ticker === undefined) {
			var self = this;
			this.ticker = window.setInterval(function () {
				self.lastTickTC = self.ytplayer.getCurrentTime();
				self.onPlaybackEvent('TICK');
			}, 250);
		}
	};
	
	LLL.Player.prototype._stopTicker = function() {
		if (this.ticker !== undefined) {
			window.clearInterval(this.ticker);
			this.ticker = undefined;
		}
	};
	
	LLL.Player.prototype.onPlaybackEvent = function(evtType) {
		var cur_ts = new Date().getTime() / 1000;
		var cur_pb_pos = this.ytplayer.getCurrentTime();
		var interaction = [cur_ts, evtType, cur_pb_pos, this.lastTickTC];
		
		this.eventlog.push(interaction);
		
		// Merging/Mapping the last two events
		var THRESHOLD = 1;
		if (this.eventlog.length >= 2) {
			var evt2 = this.eventlog.pop();
			var evt1 = this.eventlog.pop();
			var replacement = [];
			
			var evt1Type = evt1[1];
			var evt2Type = evt2[1];
			
			if (evt1Type === "TICK" && evt2Type === "TICK") {
				if (Math.abs(evt1[2]-evt2[2]) > THRESHOLD) {
					// YT HTML5 player doesn't seem to raise events when seeking in buffered segments
					replacement.push([evt1[0], "PAUSED", evt1[2], evt1[3]]);
					replacement.push([evt2[0], "PLAYING", evt2[2], evt2[3]]);
				}
				else {
					replacement.push(evt2);
				}
			}
			else if (evt1Type === "PAUSED" && evt2Type === "TICK") {
				if (Math.abs(evt1[2]-evt2[2]) > THRESHOLD) {
					replacement.push(evt1);
					replacement.push([evt2[0], "PAUSED", evt2[2], evt2[3]]);
				}
				else {
					replacement.push(evt1);
				}
			}
			else if (evt1Type === "TICK" && evt2Type === "PAUSED" && Math.abs(evt1[2]-evt2[2]) < THRESHOLD) {
				replacement.push(evt2);
			}
			else {
				replacement = [evt1, evt2];
			}
			
			for(var i=0,n=replacement.length; i<n; i++){
				this.eventlog.push(replacement[i]);
			}
		}
		
		this.logBehaviour();
	};
	
	LLL.Player.prototype.serializeEvent = function(interaction) {
		return '[' + 
			interaction[0] + ',' +
			'"' + interaction[1] + '",' +
			interaction[2].toFixed(2) + ',' +
			interaction[3].toFixed(2) +
			']';
	};
	
	LLL.Player.prototype.serializedEventLog = function() {
		var k = this.eventlog_serialized_prefix_length;
		var n = this.eventlog.length;
		var s, delim;
		
		s = '';
		delim = (k>0) ? ',' : '';
		var k_new = k;
		for (var i=k; i < (n-2); i++) {
			s += delim + this.serializeEvent(this.eventlog[i]);
			k_new++;
			delim = ',';
		}
		this.eventlog_serialized_prefix += s;
		this.eventlog_serialized_prefix_length = k_new;
		
		s = '';
		delim = (k_new>0) ? ',' : '';
		for (var i=Math.max(n-2, 0); i < n; i++) {
			s += delim + this.serializeEvent(this.eventlog[i]);
			delim = ',';
		}
		return this.eventlog_serialized_prefix + s;
	};
	
	LLL.Player.prototype.logBehaviour = function() {
		if (this.$log_field !== undefined) {
			this.$log_field.val(this.serializedEventLog());
		}
	};
	
	LLL.Player.prototype.viewSessionLength = function() {
		var res = 0;
		var curSegment = undefined;
		//var segments = [];
		
		for(var i=0,n=this.eventlog.length; i<n; i++) {
			var evt = this.eventlog[i];
			var evtType = evt[1];
			var tc = evt[2];
			var last_tc = evt[3];
			
			if (curSegment !== undefined) {
				curSegment[1] = last_tc;
			}
			
			if (evtType === 'PLAYING' || evtType === 'PAUSED' || evtType === 'ENDED') {
				if (curSegment !== undefined && curSegment[1] !== undefined) {
					res += (curSegment[1] - curSegment[0]);
					//segments.push(curSegment);
				}
				curSegment = (evtType === 'PLAYING') ? [tc, undefined] : undefined;
			}
		}
		
		if (curSegment !== undefined && curSegment[1] !== undefined) {
			res += (curSegment[1] - curSegment[0]);
			//segments.push(curSegment);
		}
		
		return res;
	};
	
	
	LLL.Player.prototype.play = function() { 
		this._setTicker();
		this.ytplayer.playVideo();
	};
	LLL.Player.prototype.pause = function() {
		this.ytplayer.pauseVideo();
	};
	LLL.Player.prototype.stop = function() {
		this._stopTicker();
		this.ytplayer.stopVideo();
	};
	LLL.Player.prototype.seek = function(timepoint, allowSeekAhead) {
		this._setTicker();
		if (allowSeekAhead === undefined) {
			allowSeekAhead = true;
		}
		this.ytplayer.seekTo(timepoint, allowSeekAhead || false);
	};
	
	LLL.Player.prototype.getDuration = function() {
		// Note: this returns an approximation (int) when playback has not yet started
		return this.ytplayer.getDuration();
	};
	
	LLL.Player.prototype.getCurrentTime = function() {
		return this.ytplayer.getCurrentTime();
	};
	
})(LLL, jQuery);


onYouTubeIframeAPIReady = LLL.onYouTubeIframeAPIReady;
LLL.loadYouTubeAPI();
jQuery(document).ready(LLL.injectPlayersIntoDOM);
