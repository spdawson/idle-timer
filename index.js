/*! Copyright (c) 2017 Simon Dawson */

/** N.B. Public API in use:
 *
 * - constructor, with element and following options: timeout, storage_key
 * - 'destroy' method
 * - 'reset' method
 * - 'idle' event
 */

import * as Utils from './utils';

/** Idle timer */
class IdleTimer {
    /** Constructor */
    constructor(
        {
            element = document, /* The element to be monitored for activity */
            initially_idle = false, /* Is the timer initially idle? */
            timeout = 30000, /* Duration (ms) before user considered idle */
            events = [
                'mousemove',
                'keydown',
                'wheel',
                'DOMMouseScroll',
                'mousewheel',
                'mousedown'
            ], /* Array of monitored events */
            storage_key = null /* localStorage key to use for synchronising this timer between browser tabs/windows */
        } = {}
    ) {
        console.log('idle-timer: constructor');

        /* Initialise member variables */
        Object.assign(this, {
            element,
            initially_idle,
            timeout,
            events,
            storage_key
        });

        this.timeout_id = null; /* setTimeout handle */
        this.pageX = null; /* Cached mouse event coordinate */
        this.pageY = null; /* Cached mouse event coordinate */

        this.__install_handlers();

        this.reset();
    }

    /** Stop the timer: remove event handlers and cancel pending timeout */
    destroy() {
        console.log('idle-timer: destroy');
        /* Clear any pending timeout */
        this.__clear();

        this.__uninstall_handlers();

        return this;
    }

    /** Install event handlers */
    __install_handlers() {
        // console.log('idle-timer: install handlers');
        const handler = (e) => { this.__handle_event(e) }
        this.events.forEach((item) => {
            this.element.addEventListener(
                item,
                handler,
                Utils.passive_supported() ? { passive: true } : false
            )
        });

        if (this.storage_key) {
            window.addEventListener('storage', handler);
        }

        return this;
    }

    /* Uninstall event handlers */
    __uninstall_handlers() {
        // console.log('idle-timer: uninstall handlers');
        const handler = (e) => { this.__handle_event(e) }
        this.events.forEach((item) => {
            this.element.removeEventListener(item, handler);
        });

        if (this.storage_key) {
            window.removeEventListener('storage', handler);
        }

        return this;
    }

    /** Toggles the idle state and fires an appropriate event */
    __toggle_idle(event = null) {
        // console.log('idle-timer: toggle idle state');
        /* Toggle state */
        this.idle = !this.is_idle();

        /* Store toggle state timestamp */
        this.last_toggled_at = Utils.now();

        /* Dispatch a custom event, with state */
        const event_name =
              'idle-timer:' + (this.is_idle() ? 'idle' : 'active');
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
    __handle_event(event) {
        // console.log('idle-timer: handle event');
        if (this.__is_paused()) {
            /* Ignore events for now */
            return;
        }

        if ('storage' === event.type && event.key !== this.storage_key) {
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
            if (this.get_elapsed_time() < 200) {
                /* Sub-200ms start-stop motion: false alarm */
                return;
            }
        }

        /* Clear any pending timeout */
        this.__clear();

        /* If the idle timer is enabled, toggle state */
        if (this.is_idle()) {
            this.__toggle_idle(event);
        }

        /* Store when user was last active */
        this.last_activity_at = Utils.now();

        /* Update mouse coordinates */
        this.pageX = event.pageX;
        this.pageY = event.pageY;

        /* Synchronise last activity timestamp between browser tabs/windows */
        if ('storage' !== event.type && this.storage_key) {
            if ('undefined' !== typeof localStorage) {
                localStorage.setItem(this.storage_key,
                                     this.get_last_active_time());
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
            () => { this.__toggle_idle(null) },
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
        this.last_activity_at = this.last_toggled_at = Utils.now();
        this.remaining = null;

        /* Reset timers */
        this.__clear();
        if (!this.is_idle()) {
            this.__start();
        }

        return this;
    }

    /** Pause timer, and cache remaining time until idle */
    pause() {
        console.log('idle-timer: pause');
        if (!this.__is_paused()) {
            /* Calculate and cache remaining time */
            this.remaining = this.timeout - this.get_elapsed_time();

            /* Clear any pending timeout */
            this.__clear();
        }

        return this;
    }

    /** Resume timer with cached remaining time until idle */
    resume() {
        console.log('idle-timer: resume');
        if (this.__is_paused()) {
            /* Start timer */
            if (!this.is_idle()) {
                this.__start(this.remaining);
            }

            /* Clear cached remaining time */
            this.remaining = null;
        }

        return this;
    }

    __is_paused() {
        return null != this.remaining;
    }

    /** Get the time remaining until becoming idle */
    get_remaining_time() {
        if (this.is_idle()) {
            /* Already idle: no time remaining */
            return 0;
        }

        if (this.__is_paused()) {
            /* Use the cached remaining time */
            return this.remaining;
        }

        /* Calculate remaining; if negative, state didn't finish toggling */
        return Math.max(0, this.timeout - (Utils.now() - this.get_last_active_time()));
    }

    get_elapsed_time() {
        return Utils.now() - this.last_toggled_at;
    }

    get_last_active_time() {
        return this.last_activity_at;
    }

    is_idle() {
        return this.idle;
    }
}

export { IdleTimer };
