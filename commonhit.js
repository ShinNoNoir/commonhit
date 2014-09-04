/* Lightweight helper functions to reduce boilerplate in HIT templates */
HIT = {
	PREVIEW_MODE: false,
	HIT_ACCEPTED: false,
	DEBUG: false,
	DEBUG_VARS: undefined,
	
	CSS_CLASSES: ["hit-question", "hit-accept-only", "hit-preview-only", "hit-debug-only",
	              "hit-step", "hit-steps"],
	
	STEPS: [],
	STEPS_CONTAINER: undefined,
	currentStep: undefined,
	currentStepIndex: -1
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
	
	
	HIT.generateIdNames = function () {
		$('div.hit-question').each(function() {
			var $question = $(this);
			var name = 'Q-' + $question.data('name');
			
			$question.find('input').each(function (j) {
				var id = name + '-' + (j+1);
				var $this = $(this);
				$this.attr('name', name)
				     .attr('id', id);
				
				$question.find('label').eq(j).attr('for', id);
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
			$('body').html(function(_, s) {
				return s.replace(/\$\{(.+?)\}/gi, function(match) {
					var value = HIT.DEBUG_VARS[match];
					return value === undefined ? match : HIT.DEBUG_VARS[match];
				});
			});
		}
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
	HIT.setupSteps();
	HIT.nextStep();
	HIT.setVisibility();
	HIT.onReady();
});

