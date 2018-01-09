/*! Copyright (c) 2017-2018 Simon Dawson */

/* Get current timestamp */
let now = () => +new Date();

/* Is the passive property supported? */
let passive_supported = function() {
    let rv = false;
    try {
        /* Use a getter in the options object, to test whether the "passive"
         * property is accessed */
        const opts = Object.defineProperty({}, 'passive', {
            get: function() {
                rv = true;
            }
        });
        window.addEventListener('idle-timer:test', null, opts);
        console.log('idle-timer: passive event listeners supported');
    } catch (e) {
        console.warn('idle-timer: passive event listeners not supported');
    }
    return rv;
};

export { now, passive_supported };
