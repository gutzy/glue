import {Tween, Easing, update, add, remove, getAll, removeAll,} from "@tweenjs/tween.js";

let tweens = []

let _tweenId = 0;

const Tw = {
    update: function(time) {
        if (time === undefined) {
        time = performance.now();
        }
        for (let tween of tweens) {
            if (tween && tween.isPlaying()) {
                tween.update(time);
            }
        }
    },

    add: function(tween) {
        add(tween);
    },

    remove: function(tween) {
        tweens = tweens.filter(t => t !== tween);
    },

    getAll: function() {
        return tweens;
    },

    removeAll: function() {
        removeAll();
    },

    create: function(from, to, duration, onUpdate = null, easing = Easing.Linear.None) {
        let tween = new Tween(from)
            .to(to, duration)
            .easing(easing)
            .onUpdate(function() {
                if (onUpdate) {
                    onUpdate(this);
                }
            })
            .onComplete(() => {
                // Remove the tween from the array when it completes
                tweens = tweens.filter(t => t !== tween);
            })
            .start(performance.now());

        tween.id = _tweenId++;
        tweens.push(tween);
        return tween;
    },
}


export default Tw;