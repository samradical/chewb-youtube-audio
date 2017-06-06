import Sono from 'sono'
import _ from 'lodash'


const MARCH_INTERVAL = 11025
const THREHSOLD = 0.5
const MIN_THREHSOLD = 0.3
const MIN_PEAKS = 30

//quite aggress
const DROP_THREHSOLD = 0.3
const MIN_DROP_THREHSOLD = 0.1
const MIN_DROPS = 20
  //The voiced speech of a typical adult male will have a fundamental frequency from 85 to 180 Hz,
const LOW_PASS_FREQ = 85

const DEFAULT = {
    channel: 0,

    peakThreshold: THREHSOLD,
    minPeakThreshold: MIN_THREHSOLD,
    minPeaks: MIN_PEAKS,
    maxPeaks: MIN_PEAKS,

    dropThreshold: DROP_THREHSOLD,
    minDropThreshold: MIN_DROP_THREHSOLD,
    minDrops: MIN_DROPS,
    maxDrops: MIN_DROPS,

    lowPassFreq: LOW_PASS_FREQ
  }
  /*
  WOrker

  onmessage = function(e) {
    var _c = -1;
      var data = e.data;
      var waveByteData = new Float32Array(data.b);
      var fftSize = data.fftSize;
      var groupNumber = data.groupNumber;
      var _groupSize = (fftSize / groupNumber);
      var groups = new Array(groupNumber).fill(0);
      for (var i = 0, l = waveByteData.length; i < l; i++) {
            if(i % _groupSize === 0){
                _c++
            }
              var _d = waveByteData[i] || 0;
            groups[_c] += (_d/fftSize/_groupSize)
      }
      postMessage(groups);
  };

  */

export default class AudioAnalysis {
  constructor(analyzer) {
    this._offlineCtx = Sono.getOfflineContext();
    this._analyzer = analyzer
      // you will have to decompress
    const breakdownBlob = new Blob(["onmessage=function(e){var _c=-1;var data=e.data;var waveByteData=new Float32Array(data.b);var fftSize=data.fftSize;var groupNumber=data.groupNumber;var _groupSize=(fftSize/groupNumber);var groups=new Array(groupNumber).fill(0);for(var i=0,l=waveByteData.length;i<l;i++){if(i%_groupSize===0){_c++}var _d=waveByteData[i]||0;groups[_c]+=(_d/fftSize/_groupSize)}postMessage(groups)};"]);
    const breakdownBlobURL = URL.createObjectURL(breakdownBlob);
    this._breakdownWorker = new Worker(breakdownBlobURL);

    this._breackdownCb = undefined;

    this._breakdownWorker.onmessage = (e) => {
      if (this._breackdownCb) {
        this._breackdownCb(e.data);
      }
    }
  }

  _getOfflineCtx() {
    this._offlineCtx = this._offlineCtx || Sono.getOfflineContext();
    return this._offlineCtx;
  }

  getPitch(cb) {
    this._analyzer.getPitch(cb);
  }

  getAmplitude(cb) {
    this._analyzer.getAmplitude(cb);
  }

  /*
  groupNumber is how many times the waveform data should be devided. multiples 4 only please
  */

  getBreakdown(groupNumber, cb) {
    if (this._breackdownCb !== cb) {
      this._breackdownCb = cb
    }

    let _f = new Float32Array(this._analyzer.fftSize)
    _f.set(this.getWaveform());
    this._breakdownWorker.postMessage({
      fftSize: this._analyzer.fftSize,
      groupNumber: groupNumber,
      b: _f.buffer
    }, [_f.buffer]);
  }


  /*
  peaks are volumes above a threshhold
  drops are relative to volume of the previous sample
  */
  getPeaks(soundBuffer, options) {

    options = Object.assign({}, DEFAULT, options)
    let _ctx = this._getOfflineCtx()
    let source = _ctx.createBufferSource()
    source.buffer = soundBuffer

    let filter = _ctx.createBiquadFilter()
    filter.frequency.value = options.lowPassFreq
    filter.type = "lowpass"

    source.connect(filter)
    filter.connect(_ctx.destination)

    source.start(0)
    let { maxPeaks, peakThreshold, maxDrops, dropThreshold } = options
    let peaks
    do {
      peaks = this._getPeaksAtThreshold(
        soundBuffer.getChannelData(options.channel),
        peakThreshold,
        maxPeaks
      );
      peakThreshold -= 0.05;
    } while (peaks.length < options.minPeaks &&
      peakThreshold >= options.minPeakThreshold &&
      peaks.length <= options.maxPeaks
    );

    peaks.forEach((peak, i) => {
      let _start = peak;
      let _dur = (peaks[i + 1] || soundBuffer.duration) - _start
      peaks[i] = { start: _start, end: _start + _dur }
    })
    return peaks
  }

  getDrops(soundBuffer, options) {

    options = Object.assign({}, DEFAULT, options)
    let _ctx = this._getOfflineCtx()
    let source = _ctx.createBufferSource()
    source.buffer = soundBuffer

    let filter = _ctx.createBiquadFilter()
    filter.frequency.value = options.lowPassFreq
    filter.type = "lowpass"

    source.connect(filter)
    filter.connect(_ctx.destination)

    source.start(0)
    let { maxPeaks, peakThreshold, maxDrops, dropThreshold } = options
    let drops

    do {
      drops = this._getDrops(
        soundBuffer.getChannelData(options.channel),
        dropThreshold,
        maxDrops
      );
      dropThreshold -= 0.01;
    } while (drops.length < options.minDrops &&
      dropThreshold >= options.minDropThreshold &&
      drops.length <= options.maxDrops
    );

    drops.forEach((drop, i) => {
      let _start = drop;
      let _dur = (drops[i + 1] || soundBuffer.duration) - _start
      drops[i] = { start: _start, end: _start + _dur }
    })

    return drops
  }

  // Function to identify peaks
  _getPeaksAtThreshold(data, threshold, max) {
    let peaksTimes = [];
    let length = data.length;
    let _values = []
    for (let i = 0; i < length;) {
      let _abs = Math.abs(data[i])
      if (_abs > threshold) {
        peaksTimes.push(i / 44100);
        // Skip forward ~ 1/4s to get past this peak.
        i += MARCH_INTERVAL;
        //store the indexs f peaks
        _values.push([_abs, peaksTimes.length - 1])
      }
      i++;
    }
    //reduce with max peaks
    let _sorted = _.sortBy(_values, (o) => {
      return o[0]
    }).reverse().slice(0, max)

    return _.sortBy(_sorted.map((o) => {
      return peaksTimes[o[1]]
    }), (d) => {
      return d
    })
  }

  // Function to identify peaks, returns seconds
  _getDrops(data, threshold, max) {
    let dropArrays = [];
    let interval = MARCH_INTERVAL;
    let length = data.length;
    let _values = []
    for (let i = 0; i < length;) {
      let _abs = Math.abs(data[i])
      let diff = _abs - Math.abs((data[i - interval] || 0));
      if (diff > threshold) {
        dropArrays.push(i / 44100);
        //store the indexs f peaks
        _values.push([_abs, dropArrays.length - 1])
      }
      i += interval;
    }
    //reduce with max peaks
    let _sorted = _.sortBy(_values, (o) => {
      return o[0]
    }).reverse().slice(0, max)

    return _sorted.map((o) => {
      return dropArrays[o[1]]
    });
  }

  //***
  //SONO
  //***

  getWaveform(float) {
    return this._analyzer.getWaveform(float)
  }

  getFloatTimeDomainData() {
    let _f = new Float32Array(this._analyzer.fftSize)
    this._analyzer.getFloatTimeDomainData(_f)
    return _f
  }

  getByteTimeDomainData() {
    let _f = new Uint8Array(this._analyzer.fftSize)
    this._analyzer.getByteTimeDomainData(_f)
    return _f
  }

}
