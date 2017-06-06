import Signals from 'signals'
const M = (() => {

  let _started = true
  let _peaks, _drops, _sound

  const onPeakSignal = new Signals()
  const onDropSignal = new Signals()

  const _setInactive = (obj) => {
    obj.active = false
  }

  const _setActive = (obj) => {
    obj.active = true
  }









  function start() {
    _started = true
  }

  function stop() {
    _started = false
  }

  function update() {
    if (!_started || !_sound) {
      return
    }
    let time = _sound.progress * _sound.duration
    if (_peaks) {
      /*
      { start: _start, end: _start + _dur }
      */
      for (var i = 0; i < _peaks.length; i++) {
        let obj = _peaks[i]
        if (time > obj.start && time < obj.end) {
          if (!obj.active) {
            _setActive(obj)
            onPeakSignal.dispatch(obj)
          }
        } else {
          _setInactive(obj)
        }
      }
    }
    if (_drops) {
      /*
      { start: _start, end: _start + _dur }
      */
      for (var i = 0; i < _drops.length; i++) {
        let obj = _drops[i]
        if (time > obj.start && time < obj.end) {
          if (!obj.active) {
            _setActive(obj)
            onDropSignal.dispatch(obj)
          }
        } else {
          _setInactive(obj)
        }
      }
    }
  }

  function setPeaks(peaks) {
    _peaks = [...peaks]
  }

  function setDrops(drops) {
    _drops = [...drops]
  }

  function setSound(sound){
  	_sound = sound
  }


  return {
    start: start,
    stop: stop,
    update: update,
    setSound: setSound,
    setPeaks: setPeaks,
    setDrops: setDrops,
    onPeakSignal: onPeakSignal,
    onDropSignal: onDropSignal,
  }

})()

module.exports = M
