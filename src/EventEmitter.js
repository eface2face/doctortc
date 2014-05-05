/**
 * @name  EventEmitter
 * @augments  DoctoRTC
 */
(function(DoctoRTC) {
	var
		EventEmitter,
		Event,
		CLASS = "EventEmitter";

	EventEmitter = function(){};

	EventEmitter.prototype = {
		/**
		 * Initialize events dictionaries.
		 * @param {Array} events
		 */
		initEvents: function(events) {
			var idx;

			this.events = {};
			this.oneTimeListeners = {};

			for (idx in events) {
				this.events[events[idx]] = [];
				this.oneTimeListeners[events[idx]] = [];
			}
		},

		/**
		* Check whether an event exists or not.
		* @param {String} event
		* @returns {Boolean}
		*/
		checkEvent: function(event) {
			return !!this.events[event];
		},

		/**
		* Add a listener to the end of the listeners array for the specified event.
		* @param {String} event
		* @param {Function} listener
		*/
		addListener: function(event, listener) {
			if (listener === undefined) {
				return;
			} else if (typeof listener !== "function") {
				DoctoRTC.throw(CLASS, "addListener", "listener must be a function");
			} else if (! this.checkEvent(event)) {
				DoctoRTC.throw(CLASS, "addListener", "unable to add a listener to a nonexistent event '" + event + "'");
			}

			this.events[event].push(listener);
		},

		on: function(event, listener) {
			this.addListener(event, listener);
		},

		/**
		* Add a one time listener for the specified event.
		* The listener is invoked only the next time the event is fired, then it is removed.
		* @param {String} event
		* @param {Function} listener
		*/
		once: function(event, listener) {
			this.on(event, listener);
			this.oneTimeListeners[event].push(listener);
		},

		/**
		* Remove a listener from the listener array for the specified event.
		* Note that the order of the array elements will change after removing the listener
		* @param {String} event
		* @param {Function} listener
		*/
		removeListener: function(event, listener) {
			var events, length,
				idx = 0;

			if (listener === undefined) {
				return;
			} else if (typeof listener !== 'function') {
				DoctoRTC.throw(CLASS, "removeListener", "listener must be a function");
			} else if (!this.checkEvent(event)) {
				DoctoRTC.throw(CLASS, "removeListener", "unable to remove a listener from a nonexistent event '" + event + "'");
			}

			events = this.events[event];
			length = events.length;

			while (idx < length) {
				if (events[idx] === listener) {
					events.splice(idx,1);
				} else {
					idx ++;
				}
			}
		},

		/**
		* Remove all listeners from the listener array for the specified event.
		* @param {String} event
		*/
		removeAllListener: function(event) {
			if (!this.checkEvent(event)) {
				DoctoRTC.throw(CLASS, "removeAllListener", "unable to remove a listener from a nonexistent event '" + event + "'");
			}

			this.events[event] = [];
			this.oneTimeListeners[event] = [];
		},

		/**
		* Get the listeners for a specific event.
		* @param {String} event
		* @returns {Array}  Array of listeners for the specified event.
		*/
		listeners: function(event) {
			if (!this.checkEvent(event)) {
				DoctoRTC.throw(CLASS, "listeners", "no event '" + event + "'");
			}

			return this.events[event];
		},

		/**
		* Execute each of the listeners in order with the supplied arguments.
		* @param {String} events
		* @param {Array} args
		*/
		emit: function(event, sender, data) {
			var listeners, length, idx, e;

			if (!this.checkEvent(event)) {
				DoctoRTC.throw(CLASS, "emit", "unable to emit a nonexistent event '" + event + "'");
			}


			listeners = this.events[event];
			length = listeners.length;

			e = new DoctoRTC.Event(event, sender, data);

			// Fire event listeners
			for (idx=0; idx<length; idx++) {
				try {
					listeners[idx].apply(null, [e]);
				} catch(err) {
					DoctoRTC.error(CLASS, "emit", err.stack);
				}
			}

			// Remove one time listeners
			for (idx in this.oneTimeListeners[event]) {
				this.removeListener(event, this.oneTimeListeners[event][idx]);
			}

			this.oneTimeListeners[event] = [];
		}
	};

	Event = function(type, sender, data) {
		this.type = type;
		this.sender = sender;
		this.data = data;
	};

	DoctoRTC.EventEmitter = EventEmitter;
	DoctoRTC.Event = Event;
}(DoctoRTC));
