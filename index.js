/*!
 * Copyright 2015-2017 ShrinkHub. All rights reserved.
 *
 * Redistribution and use in source or binary form, with or without
 * modification, is not permitted without written permission from ShrinkHub.
 *
 * https://www.shrinkhub.com
 */

/** N.B. Public API in use:
 *
 * constructor, with element and following options: timeout, timerSyncId
 * - 'destroy' method
 * - 'reset' method
 * - 'idle' event
 */

/*
  mousewheel (deprecated) -> IE6.0, Chrome, Opera, Safari
  DOMMouseScroll (deprecated) -> Firefox 1.0
  wheel (standard) -> Chrome 31, Firefox 17, IE9, Firefox Mobile 17.0

  // No need to use, use DOMMouseScroll
  MozMousePixelScroll -> Firefox 3.5, Firefox Mobile 1.0

  // Events
  WheelEvent -> see wheel
  MouseWheelEvent -> see mousewheel
  MouseScrollEvent -> Firefox 3.5, Firefox Mobile 1.0
*/

/* Get current timestamp */
let now = () => +new Date();

/* Is the passive property supported? */
let passive_supported = function() {
    /* Test via a getter in the options object to see if the passive
     * property is accessed */
    let supportsPassive = false;
    try {
        const Popts = Object.defineProperty({}, 'passive', {
            get: function() {
                supportsPassive = true;
            }
        });
        window.addEventListener('test', null, Popts);
    } catch (e) {}
    return supportsPassive;
};

/** Idle timer */
class IdleTimer {
    /** Constructor */
    constructor(opts, element = document) {
        console.log('timer: constructor');
        if ('number' === typeof opts) {
            opts = { timeout: opts };
        }

        /* Assemble options */
        const default_opts = {
            idle: false, /* Is user initially idle? */
            timeout: 30000, /* duration (ms) before user considered idle */
            events: [
                'mousemove',
                'keydown',
                'wheel',
                'DOMMouseScroll',
                'mousewheel',
                'mousedown'
            ] /* Active events */
        };
        opts = Object.assign(default_opts, opts);

        /* Initialise member variables */
        this.element = element; /* The element to which we are attached */
        this.events = opts.events; /* The array of monitored events */
        this.olddate = now(); /* The last time state changed */
        this.lastActive = this.olddate; /* The last time timer was active */
        this.idle = opts.idle; /* Current state */
        this.idleBackup = opts.idle; /* Backup of idle parameter, which will be modified */
        this.timeout = opts.timeout; /* The interval to change state */
        this.remaining = null; /* Remaining time until state changes */
        this.timerSyncId = opts.timerSyncId; /* localStorage key to use for syncing this timer across browser tabs/windows */
        this.tId = null; /* setTimeout handle */
        this.pageX = null; /* Cached mouse event coordinate */
        this.pageY = null; /* Cached mouse event coordinate */

        this.__installHandlers();
        if (!this.isIdle()) {
            this.__start();
        }
    }

    /**
     * Stops the idle timer. This removes appropriate event handlers
     * and cancels any pending timeouts
     */
    destroy() {
        console.log('timer: destroy');
        /* Clear any pending timeouts */
        this.__clear();

        this.__uninstallHandlers();

        return this;
    }

    /** Install event handlers */
    __installHandlers() {
        // console.log('timer: install handlers');
        /* Is the passive property supported? */
        const supportsPassive = passive_supported();
        if (supportsPassive) {
            console.log('timer: supports passive event listeners');
        }

        const handler = (e) => { this.__handleEvent(e) }
        this.events.forEach((item) => {
            this.element.addEventListener(
                item,
                handler,
                supportsPassive ? { passive: true } : false
            )
        });

        if (this.timerSyncId) {
            window.addEventListener('storage', handler);
        }

        return this;
    }

    /* Uninstall event handlers */
    __uninstallHandlers() {
        // console.log('timer: uninstall handlers');
        const handler = (e) => { this.__handleEvent(e) }
        this.events.forEach((item) => {
            this.element.removeEventListener(item, handler);
        });

        if (this.timerSyncId) {
            window.removeEventListener('storage', handler);
        }

        return this;
    }

    /** Toggles the idle state and fires an appropriate event */
    __toggleIdleState(event = null) {
        // console.log('timer: toggle idle state');
        /* Toggle state */
        this.idle = !this.isIdle();

        /* Store toggle state timestamp */
        this.olddate = now();

        /* Dispatch a custom event, with state */
        const custom_event =
              new CustomEvent(this.isIdle() ? 'idle' : 'active',
                              {
                                  detail: {
                                      timer: Object.assign({}, this),
                                      event: event
                                  }
                              });
        this.element.dispatchEvent(custom_event);
    }

    /** Handle an event indicating that the user isn't idle */
    __handleEvent(event) {
        // console.log('timer: handle event');
        if (this.__isPaused()) {
            /* Ignore events for now */
            return;
        }

        if ('storage' === event.type && event.key !== this.timerSyncId) {
            return;
        }

        /*
          mousemove is buggy: it can be triggered when it should not
          This typically happens 115-150ms after idle triggered
        */
        if ('mousemove' === event.type) {
            if (event.pageX === this.pageX && event.pageY === this.pageY) {
                /* Coordinates unchanged: false alarm */
                return;
            }
            if ('undefined' === typeof event.pageX &&
                'undefined' === typeof event.pageY) {
                /* Coordinates invalid: false alarm */
                return;
            }
            if (this.getElapsedTime() < 200) {
                /* Sub-200ms start-stop motion: false alarm */
                return;
            }
        }

        /* Clear any existing timeout */
        this.__clear();

        /* If the idle timer is enabled, flip */
        if (this.isIdle()) {
            this.__toggleIdleState(event);
        }

        /* Store when user was last active */
        this.lastActive = now();

        /* Update mouse coordinates */
        this.pageX = event.pageX;
        this.pageY = event.pageY;

        /* Sync lastActive across browser tabs/windows */
        if ('storage' !== event.type && this.timerSyncId) {
            if ('undefined' !== typeof localStorage) {
                localStorage.setItem(this.timerSyncId,
                                     this.getLastActiveTime());
            }
        }

        /* Set a new timeout */
        this.__start();
    }

    __start(duration = null) {
        // console.log('timer: start');
        if (null === duration) {
            duration = this.timeout;
        }
        this.tId = setTimeout(
            () => { this.__toggleIdleState(null) },
            duration
        );
        return this;
    }

    __clear() {
        // console.log('timer: clear');
        clearTimeout(this.tId);
        return this;
    }

    /** Restore initial settings and restart timer */
    reset() {
        console.log('timer: reset');
        /* Reset settings */
        this.idle = this.idleBackup;
        this.olddate = now();
        this.lastActive = this.olddate;
        this.remaining = null;

        /* Reset timers */
        this.__clear();
        if (!this.isIdle()) {
            this.__start();
        }

        return this;
    }

    /** Pause timer, and cache remaining time */
    pause() {
        console.log('timer: pause');
        if (!this.__isPaused()) {
            /* Calculate and cache remaining time */
            this.remaining = this.timeout - this.getElapsedTime();

            /* Clear any existing timeout */
            this.__clear();
        }

        return this;
    }

    /** Resume timer with cached remaining time */
    resume() {
        console.log('timer: resume');
        if (this.__isPaused()) {
            /* Start timer */
            if (!this.isIdle()) {
                this.__start(this.remaining);
            }

            /* Clear remaining */
            this.remaining = null;
        }

        return this;
    }

    __isPaused() {
        return null != this.remaining;
    }

    /** Get the time until becoming idle */
    getRemainingTime() {
        if (this.isIdle()) {
            /* No time remaining */
            return 0;
        }

        if (this.__isPaused()) {
            /* Get the cached remaining time */
            return this.remaining;
        }

        /* Calculate remaining; if negative, state didn't finish flipping */
        return Math.max(0, this.timeout - (now() - this.getLastActiveTime()));
    }

    getElapsedTime() {
        return now() - this.olddate;
    }

    getLastActiveTime() {
        return this.lastActive;
    }

    isIdle() {
        return this.idle;
    }
}

export { IdleTimer };
