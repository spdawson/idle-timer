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
 * - constructor, with element and following options: timeout, timerSyncId
 * - 'destroy' method
 * - 'reset' method
 * - 'idle' event
 */

/* Get current timestamp */
let now = () => +new Date();

/* Is the passive property supported? */
let passive_supported = function() {
    /* Test via a getter in the options object to see if the passive
     * property is accessed */
    let rv = false;
    try {
        const opts = Object.defineProperty({}, 'passive', {
            get: function() {
                rv = true;
            }
        });
        window.addEventListener('test', null, opts);
        console.log('idle-timer: passive event listeners supported');
    } catch (e) {
        console.warn('idle-timer: passive event listeners not supported');
    }
    return rv;
};

/** Idle timer */
class IdleTimer {
    /** Constructor */
    constructor(opts, element = document) {
        console.log('idle-timer: constructor');
        if ('number' === typeof opts) {
            opts = { timeout: opts };
        }

        /* Assemble options */
        const default_opts = {
            idle: false, /* Is the timer initially idle? */
            timeout: 30000, /* Duration (ms) before user considered idle */
            events: [
                'mousemove',
                'keydown',
                'wheel',
                'DOMMouseScroll',
                'mousewheel',
                'mousedown'
            ] /* Array of monitored events */
        };
        opts = Object.assign(default_opts, opts);

        /* Initialise member variables */
        this.element = element; /* The element to be monitored for activity */
        this.events = opts.events; /* Array of monitored events */
        this.initially_idle = opts.idle; /* Is the timer initially idle? */
        this.timeout = opts.timeout; /* The interval to change state */
        this.timerSyncId = opts.timerSyncId; /* localStorage key to use for syncing this timer across browser tabs/windows */
        this.timeout_id = null; /* setTimeout handle */
        this.pageX = null; /* Cached mouse event coordinate */
        this.pageY = null; /* Cached mouse event coordinate */

        this.__installHandlers();

        this.reset();
    }

    /**
     * Stops the idle timer. This removes appropriate event handlers
     * and cancels any pending timeouts
     */
    destroy() {
        console.log('idle-timer: destroy');
        /* Clear any pending timeouts */
        this.__clear();

        this.__uninstallHandlers();

        return this;
    }

    /** Install event handlers */
    __installHandlers() {
        // console.log('idle-timer: install handlers');
        const handler = (e) => { this.__handleEvent(e) }
        this.events.forEach((item) => {
            this.element.addEventListener(
                item,
                handler,
                passive_supported() ? { passive: true } : false
            )
        });

        if (this.timerSyncId) {
            window.addEventListener('storage', handler);
        }

        return this;
    }

    /* Uninstall event handlers */
    __uninstallHandlers() {
        // console.log('idle-timer: uninstall handlers');
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
    __toggleIdle(event = null) {
        // console.log('idle-timer: toggle idle state');
        /* Toggle state */
        this.idle = !this.isIdle();

        /* Store toggle state timestamp */
        this.last_toggled_at = now();

        /* Dispatch a custom event, with state */
        const event_name =
              'idle-timer:' + (this.isIdle() ? 'idle' : 'active');
        const custom_event =
              new CustomEvent(event_name,
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
        // console.log('idle-timer: handle event');
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
            this.__toggleIdle(event);
        }

        /* Store when user was last active */
        this.last_activity_at = now();

        /* Update mouse coordinates */
        this.pageX = event.pageX;
        this.pageY = event.pageY;

        /* Sync last activity timestamp across browser tabs/windows */
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
        // console.log('idle-timer: start');
        if (null === duration) {
            duration = this.timeout;
        }
        this.timeout_id = setTimeout(
            () => { this.__toggleIdle(null) },
            duration
        );
        return this;
    }

    __clear() {
        // console.log('idle-timer: clear');
        if (this.timeout_id) {
            clearTimeout(this.timeout_id);
            this.timeout_id = null;
        }
        return this;
    }

    /** Restore initial settings and restart timer */
    reset() {
        console.log('idle-timer: reset');

        /* Reset settings */
        this.idle = this.initially_idle;
        this.last_activity_at = this.last_toggled_at = now();
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
        console.log('idle-timer: pause');
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
        console.log('idle-timer: resume');
        if (this.__isPaused()) {
            /* Start timer */
            if (!this.isIdle()) {
                this.__start(this.remaining);
            }

            /* Clear cached remaining time */
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
            /* Already idle: no time remaining */
            return 0;
        }

        if (this.__isPaused()) {
            /* Use the cached remaining time */
            return this.remaining;
        }

        /* Calculate remaining; if negative, state didn't finish flipping */
        return Math.max(0, this.timeout - (now() - this.getLastActiveTime()));
    }

    getElapsedTime() {
        return now() - this.last_toggled_at;
    }

    getLastActiveTime() {
        return this.last_activity_at;
    }

    isIdle() {
        return this.idle;
    }
}

export { IdleTimer };
