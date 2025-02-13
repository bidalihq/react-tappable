var PropTypes = require('prop-types');
var React = require('react');
var ReactDOM = require('react-dom');

const SPACE_KEY = 32;
const ENTER_KEY = 13;

function getTouchProps (touch) {
	if (!touch) return {};
	return {
		pageX: touch.pageX,
		pageY: touch.pageY,
		clientX: touch.clientX,
		clientY: touch.clientY
	};
}

var Mixin = {
	propTypes: {
		moveThreshold: PropTypes.number,       // pixels to move before cancelling tap
		moveXThreshold: PropTypes.number,      // pixels on the x axis to move before cancelling tap (overrides moveThreshold)
		moveYThreshold: PropTypes.number,      // pixels on the y axis to move before cancelling tap (overrides moveThreshold)
		allowReactivation: PropTypes.bool,     // after moving outside of the moveThreshold will you allow
																					 // reactivation by moving back within the moveThreshold?
		activeDelay: PropTypes.number,         // ms to wait before adding the `-active` class
		pressDelay: PropTypes.number,          // ms to wait before detecting a press
		pressMoveThreshold: PropTypes.number,  // pixels to move before cancelling press
		preventDefault: PropTypes.bool,        // whether to preventDefault on all events
		stopPropagation: PropTypes.bool,       // whether to stopPropagation on all events

		onTap: PropTypes.func,                 // fires when a tap is detected
		onPress: PropTypes.func,               // fires when a press is detected
		onTouchStart: PropTypes.func,          // pass-through touch event
		onTouchMove: PropTypes.func,           // pass-through touch event
		onTouchEnd: PropTypes.func,            // pass-through touch event
		onMouseDown: PropTypes.func,           // pass-through mouse event
		onMouseUp: PropTypes.func,             // pass-through mouse event
		onMouseMove: PropTypes.func,           // pass-through mouse event
		onMouseOut: PropTypes.func,            // pass-through mouse event
		onKeyDown: PropTypes.func,             // pass-through key event
		onKeyUp: PropTypes.func,               // pass-through key event
	},

	defaultProps: {
		activeDelay: 0,
		allowReactivation: true,
		moveThreshold: 100,
		pressDelay: 1000,
		pressMoveThreshold: 5
	},

	getInitialState: function () {
		return {
			isActive: false,
			touchActive: false,
			pinchActive: false
		};
	},

	componentDidMount: function () {
		this.isMounted = true;
	},

	componentWillUnmount: function () {
		this.isMounted = false;
		this.cleanupScrollDetection();
		this.cancelPressDetection();
		this.clearActiveTimeout();
	},

	componentWillUpdate: function(nextProps, nextState) {
		if (this.state.isActive && !nextState.isActive) {
			this.props.onDeactivate && this.props.onDeactivate();
		} else if (!this.state.isActive && nextState.isActive) {
			this.props.onReactivate && this.props.onReactivate();
		}
	},

	processEvent: function (event) {
		if (this.props.preventDefault) event.preventDefault();
		if (this.props.stopPropagation) event.stopPropagation();
	},

	onTouchStart: function (event) {
		if (this.props.onTouchStart && this.props.onTouchStart(event) === false) return;
		this.processEvent(event);
		window._blockMouseEvents = true;
		if (event.touches.length === 1) {
			this._initialTouch = this._lastTouch = getTouchProps(event.touches[0]);
			this.initScrollDetection();
			this.initPressDetection(event, this.endTouch);
			this.initTouchmoveDetection();
			if (this.props.activeDelay > 0) {
				this._activeTimeout = setTimeout(this.makeActive, this.props.activeDelay);
			} else {
				this.makeActive();
			}
		} else if (this.onPinchStart &&
				(this.props.onPinchStart || this.props.onPinchMove || this.props.onPinchEnd) &&
				event.touches.length === 2) {
			this.onPinchStart(event);
		}
	},

	makeActive: function () {
		if (!this.isMounted) return;
		this.clearActiveTimeout();
		this.setState({
			isActive: true
		});
	},

	clearActiveTimeout: function () {
		clearTimeout(this._activeTimeout);
		this._activeTimeout = false;
	},

	initScrollDetection: function () {
		this._scrollPos = { top: 0, left: 0 };
		this._scrollParents = [];
		this._scrollParentPos = [];
		var node = ReactDOM.findDOMNode(this);

		while (node) {
			if (node.scrollHeight > node.offsetHeight || node.scrollWidth > node.offsetWidth) {
				this._scrollParents.push(node);
				this._scrollParentPos.push(node.scrollTop + node.scrollLeft);
				this._scrollPos.top += node.scrollTop;
				this._scrollPos.left += node.scrollLeft;
			}

			node = node.parentNode;
		}
	},

	initTouchmoveDetection: function () {
		this._touchmoveTriggeredTimes = 0;
	},

	cancelTouchmoveDetection: function () {
		if (this._touchmoveDetectionTimeout) {
			clearTimeout(this._touchmoveDetectionTimeout);
			this._touchmoveDetectionTimeout = null;
			this._touchmoveTriggeredTimes = 0;
		}
	},

	calculateMovement: function (touch) {
		return {
			x: Math.abs(touch.clientX - this._initialTouch.clientX),
			y: Math.abs(touch.clientY - this._initialTouch.clientY)
		};
	},

	detectScroll: function () {
		var currentScrollPos = { top: 0, left: 0 };
		for (var i = 0; i < this._scrollParents.length; i++) {
			currentScrollPos.top += this._scrollParents[i].scrollTop;
			currentScrollPos.left += this._scrollParents[i].scrollLeft;
		}
		return !(currentScrollPos.top === this._scrollPos.top && currentScrollPos.left === this._scrollPos.left);
	},

	cleanupScrollDetection: function () {
		this._scrollParents = undefined;
		this._scrollPos = undefined;
	},

	initPressDetection: function (event, callback) {
		if (!this.props.onPress) return;

		// SyntheticEvent objects are pooled, so persist the event so it can be referenced asynchronously
		event.persist();

		this._pressTimeout = setTimeout(function () {
			this.props.onPress(event);
			callback();
		}.bind(this), this.props.pressDelay);
	},

	cancelPressDetection: function () {
		clearTimeout(this._pressTimeout);
	},

	onTouchMove: function (event) {
		if (this._initialTouch) {
			this.processEvent(event);

			if (this.detectScroll()) {
				return this.endTouch(event);
			} else {
				if ((this._touchmoveTriggeredTimes)++ === 0) {
					this._touchmoveDetectionTimeout = setTimeout(function() {
						if (this._touchmoveTriggeredTimes === 1) {
							this.endTouch(event);
						}
					}.bind(this), 64);
				}
			}

			this.props.onTouchMove && this.props.onTouchMove(event);
			this._lastTouch = getTouchProps(event.touches[0]);
			var movement = this.calculateMovement(this._lastTouch);
			if (movement.x > this.props.pressMoveThreshold || movement.y > this.props.pressMoveThreshold) {
				this.cancelPressDetection();
			}
			if (movement.x > (this.props.moveXThreshold || this.props.moveThreshold) ||
				  movement.y > (this.props.moveYThreshold || this.props.moveThreshold)) {
				if (this.state.isActive) {
					if (this.props.allowReactivation) {
						this.setState({
							isActive: false
						});
					} else {
						return this.endTouch(event);
					}
				} else if (this._activeTimeout) {
					this.clearActiveTimeout();
				}
			} else {
				if (!this.state.isActive && !this._activeTimeout) {
					this.setState({
						isActive: true
					});
				}
			}
		} else if (this._initialPinch && event.touches.length === 2 && this.onPinchMove) {
			this.onPinchMove(event);
			event.preventDefault();
		}
	},

	onTouchEnd: function (event) {
		if (this._initialTouch) {
			this.processEvent(event);
			var afterEndTouch;
			var movement = this.calculateMovement(this._lastTouch);
			if (movement.x <= (this.props.moveXThreshold || this.props.moveThreshold) &&
			    movement.y <= (this.props.moveYThreshold || this.props.moveThreshold) &&
					this.props.onTap) {
				event.preventDefault();
				afterEndTouch = () => {
					var finalParentScrollPos = this._scrollParents.map(node => node.scrollTop + node.scrollLeft);
					var stoppedMomentumScroll = this._scrollParentPos.some((end, i) => {
						return end !== finalParentScrollPos[i];
					});
					if (!stoppedMomentumScroll) {
						this.props.onTap(event);
					}
				};
			}
			this.endTouch(event, afterEndTouch);
		} else if (this.onPinchEnd && this._initialPinch && (event.touches.length + event.changedTouches.length) === 2) {
			this.onPinchEnd(event);
			event.preventDefault();
		}
	},

	endTouch: function (event, callback) {
		this.cancelTouchmoveDetection();
		this.cancelPressDetection();
		this.clearActiveTimeout();
		if (event && this.props.onTouchEnd) {
			this.props.onTouchEnd(event);
		}
		this._initialTouch = null;
		this._lastTouch = null;
		if (callback) {
			callback();
		}
		if (this.state.isActive) {
			this.setState({
				isActive: false
			});
		}
	},

	onMouseDown: function (event) {
		if (window._blockMouseEvents) {
			window._blockMouseEvents = false;
			return;
		}
		if (this.props.onMouseDown && this.props.onMouseDown(event) === false) return;
		this.processEvent(event);
		this.initPressDetection(event, this.endMouseEvent);
		this._mouseDown = true;
		this.setState({
			isActive: true
		});
	},

	onMouseMove: function (event) {
		if (window._blockMouseEvents || !this._mouseDown) return;
		this.processEvent(event);
		this.props.onMouseMove && this.props.onMouseMove(event);
	},

	onMouseUp: function (event) {
		if (window._blockMouseEvents || !this._mouseDown) return;
		this.processEvent(event);
		this.props.onMouseUp && this.props.onMouseUp(event);
		this.props.onTap && this.props.onTap(event);
		this.endMouseEvent();
	},

	onMouseOut: function (event) {
		if (window._blockMouseEvents || !this._mouseDown) return;
		this.processEvent(event);
		this.props.onMouseOut && this.props.onMouseOut(event);
		this.endMouseEvent();
	},

	endMouseEvent: function () {
		this.cancelPressDetection();
		this._mouseDown = false;
		this.setState({
			isActive: false
		});
	},

	onKeyUp: function (event) {
		if (!this._keyDown) return;
		this.processEvent(event);
		this.props.onKeyUp && this.props.onKeyUp(event);
		this.props.onTap && this.props.onTap(event);
		this._keyDown = false;
		this.cancelPressDetection();
		this.setState({
			isActive: false
		});
	},

	onKeyDown: function (event) {
		if (this.props.onKeyDown && this.props.onKeyDown(event) === false) return;
		if (event.which !== SPACE_KEY && event.which !== ENTER_KEY) return;
		if (this._keyDown) return;
		this.initPressDetection(event, this.endKeyEvent);
		this.processEvent(event);
		this._keyDown = true;
		this.setState({
			isActive: true
		});
	},

	endKeyEvent: function () {
		this.cancelPressDetection();
		this._keyDown = false;
		this.setState({
			isActive: false
		});
	},

	cancelTap: function () {
		this.endTouch();
		this._mouseDown = false;
	},

	handlers: function () {
		return {
			onTouchStart: this.onTouchStart,
			onTouchMove: this.onTouchMove,
			onTouchEnd: this.onTouchEnd,
			onMouseDown: this.onMouseDown,
			onMouseUp: this.onMouseUp,
			onMouseMove: this.onMouseMove,
			onMouseOut: this.onMouseOut,
			onKeyDown: this.onKeyDown,
			onKeyUp: this.onKeyUp,
		};
	}
};

module.exports = Mixin;
