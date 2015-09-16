/* Lightweight helper functions to reduce boilerplate in HIT templates */
HIT = {
	PREVIEW_MODE: false,
	HIT_ACCEPTED: false,
	DEBUG: false,
	DEBUG_VARS: undefined,
	
	CSS_CLASSES: ["hit-question", "hit-accept-only", "hit-preview-only", "hit-debug-only",
	              "hit-step", "hit-steps",
	              "hit-foreach", "hit-data",
	              "hit-browser-ua", "hit-html5-video-support", "hit-screen-resolution"],
	
	STEPS: [],
	STEPS_CONTAINER: undefined,
	currentStep: undefined,
	currentStepIndex: -1,
	
	BROWSER_UA: navigator.userAgent,
	BROWSER_HTML5_VIDEO_SUPPORT: (!!document.createElement('video').canPlayType),
	SCREEN_RESOLUTION: [screen.width, screen.height]
};


(function (HIT, $) {

	function parseQuery(paramstr) {
		var res = {};
		if (typeof paramstr === "undefined") {
			paramstr = window.location.search.substring(1);
		}
		var parampairs = paramstr.split("&");
		var numparams = parampairs.length;
		
		for (var i = 0; i < numparams; i++) {
			var pair = parampairs[i].split("=");
			
			var key = decodeURIComponent(pair[0]);
			if (key.length == 0)
				continue;
			
			var val = (typeof pair[1] === "undefined") ? true : decodeURIComponent(pair[1]);
			if ( typeof res[key] == "undefined")
				res[key] = val;
			else if (res[key] instanceof Array)
				res[key].push(val);
			else
				res[key] = [res[key], val];
		}
		return res;
	}

	HIT.query = parseQuery();
	HIT.PREVIEW_MODE = HIT.query["assignmentId"] === "ASSIGNMENT_ID_NOT_AVAILABLE";
	HIT.DEBUG = HIT.query["debug"] === "1";
	HIT.HIT_ACCEPTED = !HIT.PREVIEW_MODE;
	
	
	HIT.generateIdNames = function ($nodes) {
		$nodes = ($nodes === undefined) ? $('div.hit-question') : $nodes;
		$nodes.each(function() {
			var $question = $(this);
			var $labels = $question.find('label');
			
			var name = 'Q-' + $question.data('name');
			
			$question.find('input').each(function (j) {
				var id = name + '-' + (j+1);
				var $this = $(this);
				$this.attr('name', name)
				     .attr('id', id);
				
				$labels.eq(j).attr('for', id);
			});
			$question.find('textarea').attr('name', name + '-explanation');
		});
	};
	
	HIT.setupSteps = function () {
		var steps = [];
		var $stepsContainer = $('.hit-steps').first();
		if ($stepsContainer.length !== 0) {
			HIT.STEPS_CONTAINER = $stepsContainer;
		}
		
		$('.hit-step').each(function() {
			var $step = $(this);
			var step = +$step.data('step');
			steps.push(step);
			$step.hide();
		});
		
		steps.sort(function(a, b) {
			return a - b;
		});
		HIT.STEPS = steps;
		HIT.currentStepIndex = -1;
	};
	
	HIT.nextStep = function () {
		if (HIT.currentStepIndex >= HIT.STEPS.length)
			return;
		
		var prevStep = HIT.currentStep;
		HIT.currentStepIndex++;
		var currentStep = HIT.currentStep = HIT.STEPS[HIT.currentStepIndex];
		
		if (prevStep !== undefined) {
			$('.hit-step[data-step="' + prevStep + '"]').hide(400);
		}
		if (currentStep !== undefined) {
			var $currentStep = $('.hit-step[data-step="' + currentStep + '"]')
			$currentStep.show(400, undefined, function () {
				if (HIT.currentStepIndex > 0) {
					(HIT.STEPS_CONTAINER || $currentStep).goTo();
				}
			});
		}
	};
	
	HIT.debugTemplate = function () {
		if (HIT.DEBUG && HIT.DEBUG_VARS !== undefined) {
			$('body *:not(script)').html(function(_, s) {
				return s.replace(/\$\{(.+?)\}/gi, function(match) {
					var value = HIT.DEBUG_VARS[match];
					return value === undefined ? match : HIT.DEBUG_VARS[match];
				});
			});
		}
	};
	
	HIT.Template = function(node, template) {
		this.node = node;
		this.$node = $(node);
		this.template = (template === undefined) ? $node.data('template') : template;
		this.$node.data('template', this.template);
		
		HIT.Template.list.push(this);
		HIT.Template.byNode[node] = this;
		if (node.id)
			HIT.Template.byId[node.id] = this;
	};
	HIT.Template.prototype.addItem = function(item) {
		var s = this.template.replace(/\{\{(.+?)\}\}/gi, function(match, p1) {
			var value = item[p1];
			return value === undefined ? match : item[p1];
		});
		this.$node.before(s);
	};
	HIT.Template.byNode = {};
	HIT.Template.byId = {};
	HIT.Template.list = [];
	
	HIT.foreachTemplate = function ($nodes) {
		$nodes = ($nodes === undefined) ? $('.hit-foreach') : $nodes;
		$nodes.each(function() {
			var $this = $(this);
			var template_string = $this.html();
			var template = new HIT.Template(this, template_string);
			
			var func_name = $this.data('func');
			var elements = func_name ? window[func_name]() : [];
			
			$.each(elements, function(_, el) {
				template.addItem(el);
			});
		}).empty();
	};
	
	HIT.setVisibility = function () {
		if (HIT.PREVIEW_MODE) {
			$('.hit-preview-only').show();
			$('.hit-accept-only').hide();
		}
		else if (HIT.HIT_ACCEPTED) {
			$('.hit-preview-only').hide();
			$('.hit-accept-only').show();
		}
		if (HIT.DEBUG) {
			$('.hit-debug-only').show();
		}
		else {
			$('.hit-debug-only').hide();
		}
	};
	
	HIT.onReady = function () {
		if (HIT.HIT_ACCEPTED) {
			HIT.generateIdNames();
		}
		$('input.hit-browser-ua').val(HIT.BROWSER_UA);
		$('input.hit-html5-video-support').val(HIT.BROWSER_HTML5_VIDEO_SUPPORT);
		$('input.hit-screen-resolution').val(HIT.SCREEN_RESOLUTION);
	};
	
	HIT.shuffleArray = function (array) {
		for (var i = array.length - 1; i > 0; i--) {
			var j = Math.floor(Math.random() * (i + 1));
			var temp = array[i];
			array[i] = array[j];
			array[j] = temp;
		}
		return array;
	};
})(HIT, jQuery);


// http://stackoverflow.com/questions/4801655/
jQuery.fn.goTo = function() {
	$('html, body').animate({
		scrollTop : $(this).offset().top + 'px'
	}, 'slow');
	return this;
}; 


jQuery(document).ready(function () {
	HIT.debugTemplate();
	HIT.foreachTemplate();
	HIT.setupSteps();
	HIT.nextStep();
	HIT.setVisibility();
	HIT.onReady();
});

