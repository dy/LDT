/*
 * Convenient utilities for cross browser textarea selection manipulation
 */
export var SelectHelper = {
	add: function( element ){
		element.insertAtCursor = element.createTextRange ?
			// IE version
			function(x){
				document.selection.createRange().text = x;
			} :
			// standards version
			function(x){
				var s = element.selectionStart,
					e = element.selectionEnd,
					v = element.value;
				element.value = v.substring(0, s) + x + v.substring(e);
				s += x.length;
				element.setSelectionRange(s, s);
			};
	}
};


/*
 * Generates a tokenizer from regular expressions for TextareaDecorator
 */
export function Parser( rules, i ){
	var api = this;

	// variables used internally
	var i = i ? 'i' : '';
	var parseRE = null;
	var ruleSrc = [];
	var ruleMap = {};

	api.add = function( rules ){
		for( var rule in rules ){
			var s = rules[rule].source;
			ruleSrc.push( s );
			ruleMap[rule] = new RegExp('^('+s+')$', i );
		}
		parseRE = new RegExp( ruleSrc.join('|'), 'g'+i );
	};
	api.tokenize = function(input){
		return input.match(parseRE);
	};
	api.identify = function(token){
		for( var rule in ruleMap ){
			if( ruleMap[rule].test(token) ){
				return rule;
			}
		}
	};

	api.add( rules );

	return api;
};


/*
 * Simplifies the creation of keybindings on any element
 */
export var Keybinder = {
	bind: function( element, keymap ){
		element.keymap = keymap;
		var keyNames = {
			8: "Backspace",
			9: "Tab",
			13: "Enter",
			16: "Shift",
			17: "Ctrl",
			18: "Alt",
			19: "Pause",
			20: "CapsLk",
			27: "Esc",
			33: "PgUp",
			34: "PgDn",
			35: "End",
			36: "Home",
			37: "Left",
			38: "Up",
			39: "Right",
			40: "Down",
			45: "Insert",
			46: "Delete",
			112: "F1",
			113: "F2",
			114: "F3",
			115: "F4",
			116: "F5",
			117: "F6",
			118: "F7",
			119: "F8",
			120: "F9",
			121: "F10",
			122: "F11",
			123: "F12",
			145: "ScrLk" };
		var keyEventNormalizer = function(e){
			// get the event object and start constructing a query
			var e = e || window.event;
			var query = "";
			// add in prefixes for each key modifier
			e.shiftKey && (query += "Shift-");
			e.ctrlKey && (query += "Ctrl-");
			e.altKey && (query += "Alt-");
			e.metaKey && (query += "Meta-");
			// determine the key code
			var key = e.which || e.keyCode || e.charCode;
			// if we have a name for it, use it
			if( keyNames[key] )
				query += keyNames[key];
			// otherwise turn it into a string
			else
				query += String.fromCharCode(key).toUpperCase();
			/* DEBUG */
			//console.log("keyEvent: "+query);
			// try to run the keybinding, cancel the event if it returns true
			if( element.keymap[query] && element.keymap[query]() ){
				e.preventDefault && e.preventDefault();
				e.stopPropagation && e.stopPropagation();
				return false;
			}
			return true;
		};
		// capture onkeydown and onkeypress events to capture repeating key events
		// maintain a boolean so we only fire once per character
		var fireOnKeyPress = true;
		element.onkeydown = function(e){
			fireOnKeyPress = false;
			return keyEventNormalizer(e);
		};
		element.onkeypress = function(e){
			if( fireOnKeyPress )
				return keyEventNormalizer(e);
			fireOnKeyPress = true;
			return true;
		};
	}
}


/*
 * Builds and maintains a styled output layer under a textarea input layer
 */
export function TextareaDecorator( textarea, parser ){
	var api = {};

	// construct editor DOM
	var parent = document.createElement("div");
	var output = document.createElement("pre");
	parent.appendChild(output);
	var label = document.createElement("label");
	parent.appendChild(label);
	// replace the textarea with RTA DOM and reattach on label
	textarea.parentNode.replaceChild( parent, textarea );
	label.appendChild(textarea);
	// transfer the CSS styles to our editor
	parent.className = 'ldt ' + textarea.className;
	textarea.className = '';
	// turn off built-in spellchecking in firefox
	textarea.spellcheck = false;
	// turn off word wrap
	textarea.wrap = "off";

	// coloring algorithm
	var color = function( input, output, parser ){
		var oldTokens = output.childNodes;
		var newTokens = parser.tokenize(input);
		var firstDiff, lastDiffNew, lastDiffOld;
		// find the first difference
		for( firstDiff = 0; firstDiff < newTokens.length && firstDiff < oldTokens.length; firstDiff++ )
			if( newTokens[firstDiff] !== oldTokens[firstDiff].textContent ) break;
		// trim the length of output nodes to the size of the input
		while( newTokens.length < oldTokens.length )
			output.removeChild(oldTokens[firstDiff]);
		// find the last difference
		for( lastDiffNew = newTokens.length-1, lastDiffOld = oldTokens.length-1; firstDiff < lastDiffOld; lastDiffNew--, lastDiffOld-- )
			if( newTokens[lastDiffNew] !== oldTokens[lastDiffOld].textContent ) break;
		// update modified spans
		for( ; firstDiff <= lastDiffOld; firstDiff++ ){
			oldTokens[firstDiff].className = parser.identify(newTokens[firstDiff]);
			oldTokens[firstDiff].textContent = oldTokens[firstDiff].innerText = newTokens[firstDiff];
		}
		// add in modified spans
		for( var insertionPt = oldTokens[firstDiff] || null; firstDiff <= lastDiffNew; firstDiff++ ){
			var span = document.createElement("span");
			span.className = parser.identify(newTokens[firstDiff]);
			span.textContent = span.innerText = newTokens[firstDiff];
			output.insertBefore( span, insertionPt );
		}
	};

	api.input = textarea;
	api.output = output;
	api.update = function(){
		var input = textarea.value;
		if( input ){
			color( input, output, parser );
			// determine the best size for the textarea
			var lines = input.split('\n');
			// find the number of columns
			var maxlen = 0, curlen;
			for( var i = 0; i < lines.length; i++ ){
				// calculate the width of each tab
				var tabLength = 0, offset = -1;
				while( (offset = lines[i].indexOf( '\t', offset+1 )) > -1 ){
					tabLength += 7 - (tabLength + offset) % 8;
				}
				var curlen = lines[i].length + tabLength;
				// store the greatest line length thus far
				maxlen = maxlen > curlen ? maxlen : curlen;
			}
			textarea.cols = maxlen + 1;
			textarea.rows = lines.length + 2;
		} else {
			// clear the display
			output.innerHTML = '';
			// reset textarea rows/cols
			textarea.cols = textarea.rows = 1;
		}
	};

	// detect all changes to the textarea,
	// including keyboard input, cut/copy/paste, drag & drop, etc
	if( textarea.addEventListener ){
		// standards browsers: oninput event
		textarea.addEventListener( "input", api.update, false );
	} else {
		// MSIE: detect changes to the 'value' property
		textarea.attachEvent( "onpropertychange",
			function(e){
				if( e.propertyName.toLowerCase() === 'value' ){
					api.update();
				}
			}
		);
	}
	// initial highlighting
	api.update();

	return api;
};


export default TextareaDecorator
