let Y = require('./index').default
const GUI = require('./gui').default
let y = new Y()
y.load('oAWxGe1ks4g', 3, { loop: true })
  .then(sound => {
    console.log(sound);
    console.log(y.monitor);
    sound.play()
    y.monitor.setSound(sound)
    y.monitor.setPeaks(y.getPeaks())
    y.monitor.start()
    y.monitor.onPeakSignal.add((t) => {
      console.log(t);
    })

    initGui()
    update()
  })


function update() {

  y.monitor.update()

  window.requestAnimationFrame(update)
}


function initGui() {
  let _guiC = {
    peakThreshold: 0.5,
    minPeakThreshold: 0.3,
    maxPeaks: 20,
    minPeaks: 20,

    dropThreshold: 0.3,
    minDropThreshold: 0.1,
    maxDrops: 20,
    minDrops: 20,
    lowPassFreq: 85,
  }

  let _uniforms = _.clone(_guiC)

  let gui = new GUI(_guiC)
  gui.addNumber('peakThreshold', 0., 1.01, (changedValue) => {
    _uniforms.peakThreshold = changedValue
    y.monitor.setPeaks(y.getPeaks(null, _uniforms))
  })
  gui.addNumber('minPeakThreshold', 0, 1, (changedValue) => {
    _uniforms.minPeakThreshold = changedValue
    y.monitor.setPeaks(y.getPeaks(null, _uniforms))
  })
  gui.addNumber('minPeaks', 10, 70, (changedValue) => {
    _uniforms.minPeaks = changedValue
    y.monitor.setPeaks(y.getPeaks(null, _uniforms))
  })
  gui.addNumber('maxPeaks', 10, 70, (changedValue) => {
    _uniforms.maxPeaks = changedValue
    y.monitor.setPeaks(y.getPeaks(null, _uniforms))
  })
  gui.addNumber('dropThreshold', 0., 1.01, (changedValue) => {
    _uniforms.dropThreshold = changedValue
    y.monitor.setPeaks(y.getPeaks(null, _uniforms))
  })
  gui.addNumber('minDropThreshold', 0., 1.01, (changedValue) => {
    _uniforms.minDropThreshold = changedValue
    y.monitor.setPeaks(y.getPeaks(null, _uniforms))
  })
  gui.addNumber('minDrops', 10, 70, (changedValue) => {
    _uniforms.minDrops = changedValue
    y.monitor.setPeaks(y.getPeaks(null, _uniforms))
  })
  gui.addNumber('maxDrops', 10, 70, (changedValue) => {
    _uniforms.maxDrops = changedValue
    y.monitor.setPeaks(y.getPeaks(null, _uniforms))
  })
  gui.addNumber('lowPassFreq', 10, 300, (changedValue) => {
    _uniforms.lowPassFreq = changedValue
    y.monitor.setPeaks(y.getPeaks(null, _uniforms))
  })
}