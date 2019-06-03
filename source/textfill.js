/*
Jetroid/textfill.js v0.0.1, 2019
Adapted from jquery-textfill/jquery-textfill, v0.6.2, Feb 2018

Usage:
TextFill(".some-selector",{
	minFontPixels: {Number}, {4}
	maxFontPixels: {Number}, {40}
	innerTag: {Selector}, {span}
	widthOnly: {Boolean}, {false}
	explicitWidth: {Number}, {null}
	explicitHeight: {Number}, {null}
	changeLineHeight: {Boolean}, {false}
	allowOverflow: {Boolean}, {false}
	debug: {Boolean}, {false}
});

Options:

minFontPixels:      Minimal font size (in pixels). The text will shrink up to this value.
maxFontPixels:      Maximum font size (in pixels). The text will stretch up to this value.. If it's a negative value (size <= 0), the text will stretch to as big as the container can accommodate.
innerTag:           The child element tag to resize. We select it by using container.querySelector(innerTag)
widthOnly:          Will only resize to the width restraint. The font might become tiny under small containers.
explicitWidth:      Explicit width to resize. Defaults to the container's width.
explicitHeight:     Explicit height to resize. Defaults to the container's height.
changeLineHeight:   Also change the line-height of the parent container. This might be useful when shrinking to a small container.
allowOverflow:      Allows text to overflow when minFontPixels is reached. Won't fail resizing, but instead will overflow container.
debug:              Output debugging messages to console.


Original Project: 
https://github.com/jquery-textfill/jquery-textfill

Jet Holt - 2019

Copyright (C) 2019 Jet Holt
Copyright (C) 2009-2018 Russ Painter (GeekyMonkey)
Copyright (C) 2012-2013 Yu-Jie Lin

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/
TextFill = function(selector, options){

	//  _____  _______ _______ _____  _____  __   _ _______
	// |     | |_____|    |      |   |     | | \  | |______
	// |_____| |          |    __|__ |_____| |  \_| ______|

	var defaultOptions = {
		debug            : false,
		maxFontPixels    : 40,
		minFontPixels    : 4,
		innerTag         : 'span',
		widthOnly        : false,
		success          : null, // callback when a resizing is done
		fail             : null, // callback when a resizing is failed
		complete         : null, // callback when all is done
		explicitWidth    : null,
		explicitHeight   : null,
		changeLineHeight : false,
		truncateOnFail   : false,
		allowOverflow    : false // If true, text will stay at minFontPixels but overflow container w/out failing 
	};

	// Merge provided options and default options
	options = options || {};
	for (var opt in defaultOptions)
		if (defaultOptions.hasOwnProperty(opt) && !options.hasOwnProperty(opt))
			options[opt] = defaultOptions[opt];

	// _______ _     _ __   _ _______ _______ _____  _____  __   _ _______
	// |______ |     | | \  | |          |      |   |     | | \  | |______
	// |       |_____| |  \_| |_____     |    __|__ |_____| |  \_| ______|
	//
	// Predefining the awesomeness

	// Output arguments to the Debug console
	// if "Debug Mode" is enabled
	function _debug() {
		if (!options.debug
			||  typeof console       == 'undefined'
			||  typeof console.debug == 'undefined') {
			return;
		}
		console.debug.apply(console, arguments);
	}

	// Output arguments to the Warning console
	function _warn() {
		if (typeof console      == 'undefined' ||
			typeof console.warn == 'undefined') {
			return;
		}
		console.warn.apply(console, arguments);
	}

	// Outputs all information on the current sizing
	// of the font.
	// For arguments, see _sizing(), below
	function _debug_sizing(prefix, ourText, maxHeight, maxWidth, minFontPixels, maxFontPixels, fontSize) {

		function _m(v1, v2) {

			var marker = ' / ';

			if (v1 > v2) {
				marker = ' > ';
			}
			else if (v1 == v2) {
				marker = ' = ';
			}
			return marker;
		}

		_debug(
			'[TextFill] '  + prefix + ' { ' +
			'font-size: ' + fontSize + ',' +
			'Height: '    + ourText.offsetHeight + 'px ' + _m(ourText.offsetHeight, maxHeight) + maxHeight + 'px,' +
			'Width: '     + ourText.offsetWidth  + _m(ourText.offsetWidth , maxWidth)  + maxWidth + ',' +
			'minFontPixels: ' + minFontPixels + 'px, ' +
			'maxFontPixels: ' + maxFontPixels + 'px }'
		);
	}

	/**
	 * Calculates which size the font can get resized,
	 * according to constrains.
	 *
	 * @param {String} prefix 
	 *		Gets shown on the console before all the arguments, if debug mode is on.
	 * @param {Object} ourText
	 *	The DOM element to resize that contains the text.
	 * @param {'offsetWidth' || 'offsetHeight'} measurement
	 *		Property called on `ourText` that's used to compare with `max`.
	 * @param {number} max
	 *		Maximum value, that gets compared with `measurement` called on `ourText`.
	 * @param {number} minFontPixels
	 *		Minimum value the font can get resized to (in pixels).
	 * @param {number} maxFontPixels
	 *		Maximum value the font can get resized to (in pixels).
	 *
	 * @return Size (in pixels) that the font can be resized.
	 */
	function _sizing(prefix, ourText, measurement, max, maxHeight, maxWidth, minFontPixels, maxFontPixels) {

		_debug_sizing(
			prefix, ourText,
			maxHeight, maxWidth,
			minFontPixels, maxFontPixels,
			'font size not yet calculated'
		);

		// The kernel of the whole plugin, take most attention
		// on this part.
		//
		// This is a loop that keeps increasing the `font-size`
		// until it fits the parent element.
		//
		// - Start from the minimal allowed value (`minFontPixels`)
		// - Guesses an average font size (in pixels) for the font,
		// - Resizes the text and sees if its size is within the
		//   boundaries (`minFontPixels` and `maxFontPixels`).
		//   - If so, keep guessing until we break.
		//   - If not, return the last calculated size.
		//
		// I understand this is not optimized and we should
		// consider implementing something akin to
		// Daniel Hoffmann's answer here:
		//
		//     http://stackoverflow.com/a/17433451/1094964
		//
		
		while (minFontPixels < (Math.floor(maxFontPixels) - 1)) {

			var fontSize = Math.floor((minFontPixels + maxFontPixels) / 2);
			ourText.style.fontSize = fontSize + "px";
			var curSize = ourText[measurement];

			if (curSize <= max) {
				minFontPixels = fontSize;

				if (curSize == max) {
					break;
				}
			}
			else {
				maxFontPixels = fontSize;
			}

			_debug_sizing(
				prefix, ourText,
				maxHeight, maxWidth,
				minFontPixels, maxFontPixels, fontSize
			);
		}

		ourText.style.fontSize = maxFontPixels + "px";

		if (ourText[measurement] <= max) {
			minFontPixels = maxFontPixels;

			_debug_sizing(
				prefix + '* ', ourText,
				maxHeight, maxWidth,
				minFontPixels, maxFontPixels,
				maxFontPixels
			);
		}
		return minFontPixels;
	}

	// _______ _______ _______  ______ _______
	// |______    |    |_____| |_____/    |
	// ______|    |    |     | |    \_    |
    //

	_debug('[TextFill] Start Debug');

	var elements;
	if (typeof selector === 'string') {
		elements = document.querySelectorAll(selector);
	} else if (selector instanceof Element || selector instanceof HTMLDocument) {
		// Support for DOM nodes
		elements = selector;
	} else if (selector.length) {
		// Support for array based queries (such as jQuery)
		elements = selector;
	}

	for (var i = 0; i < elements.length; i++) {
		var parent = elements[i];

		// ourText contains the child element we will resize.
		var ourText = parent.querySelector(options.innerTag);
		var ourTextComputedStyle = window.getComputedStyle(ourText);

		_debug('[TextFill] Inner text: ' + ourText.textContent);
		_debug('[TextFill] All options: ', options);
		_debug('[TextFill] Maximum sizes: { ' +
			'Height: ' + maxHeight + 'px, ' +
			'Width: '  + maxWidth  + 'px' + ' }'
		);

		// Want to make sure our text is visible
		if (ourTextComputedStyle === 'none') {
            if (options.fail)
				options.fail(parent);

			_debug(
				'[TextFill] Failure: Inner element not visible.'
			);

			continue;
        }

        // Will resize to these dimensions.
		// Use explicit dimensions when specified
		var maxHeight = options.explicitHeight || parent.offsetHeight;
		var maxWidth  = options.explicitWidth  || parent.offsetWidth;

		var oldFontSize   = ourTextComputedStyle.getPropertyValue("font-size");
		var oldLineHeight = ourTextComputedStyle.getPropertyValue("line-height");

		var lineHeight  = parseFloat(oldLineHeight) / parseFloat(oldFontSize);

		var minFontPixels = options.minFontPixels;

		// Remember, if this `maxFontPixels` is negative,
		// the text will resize to as long as the container
		// can accomodate
		var maxFontPixels = (options.maxFontPixels <= 0 ?
							 maxHeight :
							 options.maxFontPixels);

		// 1. Calculate which `font-size` would
		//    be best for the Height
		var fontSizeHeight = undefined;

		// If width-only, we don't care about height
		if (!options.widthOnly) {
			fontSizeHeight = _sizing(
				'Height', ourText,
				'offsetHeight', maxHeight,
				maxHeight, maxWidth,
				minFontPixels, maxFontPixels
			);
		}

		// 2. Calculate which `font-size` would
		//    be best for the Width
		var fontSizeWidth = undefined;

		// We need to measure with nowrap if we only care about width,
		// otherwise wrapping occurs and the measurement is wrong
		if (options.widthOnly) {
  			ourText.style.whiteSpace = "nowrap";
		}

		fontSizeWidth = _sizing(
			'Width', ourText,
			'offsetWidth', maxWidth,
			maxHeight, maxWidth,
			minFontPixels, maxFontPixels
		);

		// 3. Actually resize the text!
		var fontSizeFinal;
		if (options.widthOnly) {
			fontSizeFinal = fontSizeWidth;
		} else {
			fontSizeFinal = Math.min(fontSizeHeight, fontSizeWidth);
		}

		ourText.style.fontSize = fontSizeFinal + "px";
		if (options.changeLineHeight) {
			parent.style.lineHeight = (lineHeight * fontSizeFinal) + 'px';
		}

		// Test if something wrong happened
		// If font-size increasing, we weren't supposed to exceed the original size 
		// If font-size decreasing, we hit minFontPixels, and still won't fit 
		if ((ourText.offsetWidth  > maxWidth && !options.allowOverflow) ||
			(ourText.offsetHeight > maxHeight && !options.widthOnly && !options.allowOverflow)) { 

			ourText.style.fontSize = oldFontSize;

			// Failure callback
			if (options.fail) {
				options.fail(parent);
			}

			_debug(
				'[TextFill] Failure { ' +
				'Reason: Either exceeded original size or attempted to go below minFontPixels... ' +
				'Current Width: '  + ourText.offsetWidth  + ', ' +
				'Maximum Width: '  + maxWidth         + ', ' +
				'Current Height: ' + ourText.offsetHeight + ', ' +
				'Maximum Height: ' + maxHeight        + ' }'
			);

			continue;

		} else if (options.success) {
			options.success(parent);
		}

		_debug(
			'[TextFill] Finished { ' +
			'Old font-size: ' + oldFontSize + ', ' +
			'New font-size: ' + fontSizeFinal + ' }'
		);
	}

	// Complete callback
	if (options.complete) {
		options.complete();
	}

	_debug('[TextFill] End Debug');

}
