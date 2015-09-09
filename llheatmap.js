/* Heat-map for LikeLines "Light"; Must be included after lllight.js */
LLL.HEATMAP = {
	DEFAULT_WIDTH: LLL.DEFAULT_WIDTH,
	DEFAULT_HEIGHT: 20,

	CSS_CLASSES: ["lll-heatmap"],
};

(function (LLL, HEATMAP, $) {
	
	HEATMAP.DummyPlayer = function(duration) {
		this.duration = duration;
	};
	HEATMAP.DummyPlayer.prototype.getDuration = function() {
		return this.duration;
	};
	HEATMAP.DummyPlayer.prototype.seek = function() {};
	HEATMAP.DummyPlayer.prototype.getViewHistogram = function() {
		return [0];
	};
	
	HEATMAP.injectHeatmapsIntoDOM = function () {
		var exec = function () {
			$('.lll-heatmap:not(canvas)').each(function() {
				var $heatmap_div = $(this);
				
				var lllplayer_exposed_name = $heatmap_div.data('for');
				var map = [];
				var width = $heatmap_div.data('width');
				var height = $heatmap_div.data('height');
				
				var live_map;
				var data_map = $heatmap_div.data('map') || '';
				if (!(live_map = (data_map.toUpperCase() === 'LIVE'))) {
					map = HEATMAP._parseFloatList(data_map);
				}
				
				var lllplayer = window[lllplayer_exposed_name];
				var exposed_name = $heatmap_div.data('name');
				
				var heatmap = new HEATMAP.Heatmap(this, lllplayer, map, width, height);
				heatmap.showLiveHeatmap(live_map);
				
				if (exposed_name !== undefined) {
					window[exposed_name] = heatmap;
				}
				
				// experimental feature:
				var oncreated = $heatmap_div.data('oncreated');
				if (oncreated !== undefined) {
					window[oncreated](heatmap);
				}
			});
		};
		
		// NOTE: An lllplayer is created *after* the YouTube API has loaded.
		// Since heat-maps depend on an lllplayer, execution needs to be deferred as well.
		if (LLL._ytReady) {
			exec();
		}
		else {
			LLL._creationQueue.push(exec);
		}
	};
	
	HEATMAP._parseFloatList = function(s) {
		var parts = s.split(',');
		var fs = [];
		
		for(var i=0, n=parts.length; i < n; i++){
			if (!/^\s*$/.test(parts[i])) {
				fs.push( parseFloat(parts[i]) );
			}
		}
		return fs;
	};
	
	HEATMAP.Heatmap = function(node, lllplayer, map, width, height) {
		this.node = node;
		this.canvas = document.createElement('canvas');
		this.lllplayer = lllplayer;
		this.timecode = document.createElement('span');
		this.map = map || [];
		this.live_map_timer = undefined;
		
		this.width = width || HEATMAP.DEFAULT_WIDTH;
		this.height = height || HEATMAP.DEFAULT_HEIGHT;
		
		this._clickEventListeners = [];
		
		$(this.canvas).prop({
			width: this.width,
			height: this.height
		});
		$(node).append(this.canvas)
		       .append($(this.timecode).addClass('lll-timecode').html('00:00')
		);
		
		this._bindHandlers();
		this.paintHeatmap(map);
	};
	
	HEATMAP.Heatmap.prototype._eventToTimepoint = function (e, domNode) {
		var $node = $(domNode);
		
		var x = e.clientX + 
		        ((window.pageXOffset !== undefined) ? window.pageXOffset 
		                                            : (document.documentElement || document.body).scrollLeft) - 
		        $node.offset().left;
		var w = $node.outerWidth();
		var d = this.lllplayer.getDuration();
		
		if (x < 0) {
			x = 0;
		}
		else if (x >= w) {
			x = w-1;
		}
		
		return (d !== -1) ? x*d/w : -1;
	};
	
	HEATMAP.Heatmap.prototype._bindHandlers = function() {
		var self = this;
		
		var $canvas = $(this.canvas);
		var canvasOnClick = function(e) {
			var t = self._eventToTimepoint(e, this);
			self.lllplayer.seek(t);
			
			var handlers = self._clickEventListeners;
			for(var i=0, n=handlers.length; i<n; i++) {
				handlers[i].call(self, t);
			}
		};
		$(this.canvas).click(canvasOnClick);
		
		var timecode = this.timecode;
		var updateTimeCode = function(e) {
			var x = (e.clientX + 20) + 'px';
			var y = (e.clientY + 0) + 'px';
			timecode.style.top = y;
			timecode.style.left = x;
			
			var t = self._eventToTimepoint(e, self.canvas);
			$(timecode).html(HEATMAP.timecodeToHHMMSS(t));
		};
		$(this.node).mousemove(updateTimeCode);
	};
	
	HEATMAP.Heatmap.prototype.addClickListener = function(handler) {
		var handlers = this._clickEventListeners;
		handlers.push(handler);
		
		var self = this;
		var disposed = false;
		var subscription = {
			dispose: function() {
				if (!disposed) {
					var pos = $.inArray(handler, handlers);
					if (pos > -1) {
						handlers.splice(pos, 1);
					}
					disposed = true;
				}
			}
		}
		return subscription;
	};
	
	HEATMAP.Heatmap.prototype.paintHeatmap = function(heatmap, dontScale) {
		var ctx = this.canvas.getContext('2d');
		var w = this.width;
		var elWidth = 1;
		var elHeight = this.height;
		
		var palette = HEATMAP.DEFAULT_PALETTE;
		
		if (!dontScale) {
			heatmap = HEATMAP._scaleArray(heatmap, w);
		}
		
		for(var i = 0; i < w; i++) {
			ctx.beginPath();
			
			var val = heatmap[i];
			var color = palette(val);
			ctx.fillStyle = 'rgb(' + color[0] + ',' + color[1] + ',' + color[2] + ')';
			
			ctx.fillRect(i, 0, elWidth, elHeight);
		}
	};
	
	HEATMAP.Heatmap.prototype.heatmapFromViewHistogram = function(bins) {
		var heatmap = LLL.Util.zeros(bins.length);
		
		var max;
		max = bins[0];
		for (var i = 1, n = bins.length; i < n; i++) {
			max = Math.max(max, bins[i]);
		}
		
		var scale = (max > 0) ? max : 1;
		for (var i = 0, n = heatmap.length; i < n; i++) {
			heatmap[i] = bins[i] / scale;
		}
		
		return heatmap;
	};
	
	HEATMAP.Heatmap.prototype.showHeatmapOf = function(lllplayer) {
		this.map = this.heatmapFromViewHistogram(lllplayer.getViewHistogram());
		this.paintHeatmap(this.map);
	};
	
	HEATMAP.Heatmap.prototype.showLiveHeatmap = function(show) {
		show = (show === undefined) || show;
		
		if (show && this.live_map_timer === undefined) {
			var self = this;
			this.live_map_timer = window.setInterval(function () {
				if (!self.lllplayer.ready)
					return;
				self.showHeatmapOf(self.lllplayer);
			}, 500);
		}
		else if (!show && this.live_map_timer !== undefined) {
			window.clearInterval(this.live_map_timer);
			this.live_map_timer = undefined;
		}
	};
	
	HEATMAP.timecodeToHHMMSS = function(t, forceHours) {
		var hours = Math.floor(t / 3600);
		t -= hours*3600;
		var minutes = Math.floor(t / 60);
		t -= minutes*60;
		var seconds = Math.floor(t);
		
		var hh = (hours < 10)   ? ('0'+hours)   : hours;
		var mm = (minutes < 10) ? ('0'+minutes) : minutes;
		var ss = (seconds < 10) ? ('0'+seconds) : seconds;
		
		return ((hours > 0 || forceHours) ? (hh+':') : '') + mm+':'+ss; 
	};
	
	HEATMAP._scaleArray = function (data, newSize) {
		var n = (data || []).length;
		var scaledArray;
		
		if (n == 0 || newSize == 0) {
			return LLL.Util.zeros(newSize);
		}
		else if (n <= 2) {
			return LLL.Util.linspace(data[0], data[n-1], newSize);
		}
		
		// interpolate
		var step = (n-1)/(newSize-1);
		scaledArray = [];
		for (var j = 0; j < newSize-1; j++) {
			var x = j*step;
			var i = Math.floor(x);
			scaledArray[j] = data[i] + (x-i) * (data[i+1] - data[i]);
		}
		scaledArray[newSize-1] = data[n-1];
		
		return scaledArray;
	}
	
	HEATMAP.createPalette = function (/*colorstop, ...*/) {
		var colorstops = Array.prototype.slice.call(arguments);
		var n = colorstops.length;
		
		return function (x) {
			for (var i = 0; i < n; i++) {
				if (x == colorstops[i][0]) {
					return colorstops[i][1];
				} else if (x < colorstops[i][0]) {
					var a = i-1;
					var b = i;
					var c_a = colorstops[a][1];
					var c_b = colorstops[b][1];
					
					var w_a = (colorstops[b][0] - x) / (colorstops[b][0] - colorstops[a][0]);
					var w_b = 1 - w_a;
					
					var res = [0,0,0];
					for (var k=0; k<3; k++) {
						res[k] = Math.round(w_a*c_a[k] + w_b*c_b[k]);
					}
					return res;
				} 
			};
			
			return [0,0,0];
		};
	};
	
	HEATMAP.DEFAULT_PALETTE = HEATMAP.createPalette([0.0, [255, 255, 255]],
	                                                [0.2, [255, 255,   0]],
	                                                [1.0, [255,   0,   0]]);
	
})(LLL, LLL.HEATMAP, jQuery);


jQuery(document).ready(LLL.HEATMAP.injectHeatmapsIntoDOM);
