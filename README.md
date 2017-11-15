# idle-timer

A timer to detect lapses in browser activity

The initial implementation is based on [jquery-idletimer](https://github.com/thorst/jquery-idletimer), but rewritten to break the dependency on jQuery, and to take advantage of modern JavaScript.

## Synopsis

The browser is considered "idle", if within a specified period of time:

* The mouse has not moved
* The mouse wheel has not scrolled
* No key has been pressed

When such an "idle" state is detected, an event is dispatched on the element
on which the idle timer has been registered.

## Usage

```js
import { IdleTimer } from 'idle-timer';

let handle_idle_timer_event = function(event) {
    const detail = event.detail;
    const timer = detail.timer;
    const original_event = detail.event; /* N.B. May be null */
    console.log('timer: %s (%s)',
                event.type,
                (original_event ? original_event.type : null));
};

console.log('timer: setup');
let timer = new IdleTimer({timeout: 2000, element: window.document});
window.document.addEventListener('idle-timer:idle', handle_idle_timer_event);
window.document.addEventListener('idle-timer:active', handle_idle_timer_event);
```

## API: Constructor options

### `element`

Defaulting to `document`, this indicates the element which is to be monitored
for activity.

### `initially_idle`

Defaulting to `false`, this indicates whether the instance should be
considered "idle" initially.


### `timeout`

Defaulting to `30000`, this indicates the duration in milliseconds after which
the "idle" state is triggered.

### `events`

This indicates the array of events to be monitored, and defaults to the
following value.

```js
[
    'mousemove',
    'keydown',
    'wheel',
    'DOMMouseScroll',
    'mousewheel',
    'mousedown'
]
```

### `storage_key`

Defaulting to `null`, this indicates a `localStorage` key to be used for
synchronising the timer between multiple browser tabs/windows.

## API: Timer management methods

Clean up a `timer` that is no longer required:
```js
timer.destroy();
```

Reset a `timer` to its initial conditions:
```js
timer.reset();
```

Pause a `timer`:
```js
timer.pause();
```

Resume a previously-paused `timer`:
```js
timer.resume();
```

## API: Query methods

Get the number of milliseconds remaining until "idle" state detected by
`timer`:
```js
timer.get_remaining_time();
```

Get the number of milliseconds elapsed on `timer` since the last "idle" or
"active" state transition occurred:
```js
timer.get_elapsed_time();
```

Get the timestamp in milliseconds of the last detected activity:
```js
timer.get_last_active_time();
```

Is `timer` currently indicating an "idle" state?
```js
timer.is_idle();
```
