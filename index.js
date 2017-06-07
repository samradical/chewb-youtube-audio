let YoutubeSocket = require('chewb-dash-player-youtube-socket').default
let Analyzer = require('./analyzer').default
let Emitter = require('./utils/Emitter')
let VoUtils = require('dash-player-voutils')
const _ = require('lodash')
const Q = require('bluebird')
const Sono = require('sono')
var raf = require('raf')
const BufferUtils = require('audio-buffer-utils');

const EVENTS = {
	ON_PEAK: 'ON_PEAK',
	ON_DROP: 'ON_DROP',
	ON_BUFFER_CHUNK: 'ON_BUFFER_CHUNK'
}

const ENCODING = 44100

let Monitor = require('./monitor')

export { EVENTS }

export default class YoutubeAudio {

	constructor(IO) {
		if (!IO) {
			throw new Error('No socket.io client')
		}
		this.socket = new YoutubeSocket(IO)
		this.audioCtx = Sono.context
		this._onSoundProgressBound = this._onSoundProgress.bind(this)
		this._emitter = new Emitter.default()
	}


	getVideoInfo(params){
		return this.socket.getVideoInfo(params)
	}

	load(videoId, segments = 9999, options = {}) {
			let _uuid = VoUtils.getUUID('audio', videoId)
		return this.socket.getManifest('audio', videoId,_uuid, options)
			.then(manifest => {
				console.log(manifest);
				console.log("_uuid", _uuid);
				let _vo = VoUtils.generateVideoVo(_uuid)
				console.log(_vo);
				VoUtils.addManifestToVideoVo(manifest, _vo)
				VoUtils.incrementRefIndex(_vo, segments)

				let _mediaSourceVo = VoUtils.generateMediaSourceVo(_vo)
				let _indexBuffer
				return this.socket.getIndexBuffer(
					_vo.uuid,
					_mediaSourceVo.url,
					_mediaSourceVo.indexRange
				).then(buffer => {
					_indexBuffer = buffer
					return this.socket.getRangeBuffer(
						_vo.uuid,
						_mediaSourceVo.url,
						_mediaSourceVo.byteRange, {
							youtubeDl: true,
							uuid: _vo.uuid,
							duration: _mediaSourceVo.duration
						}
					).then(buffer => {
						return this._decodeBuffer(_indexBuffer, buffer, options)
					})
				})
			})
	}

	_decodeBuffer(indexBuffer, rangeBuffer, options = {}) {
		return new Q((yes, no) => {

			this._indexBuffer = indexBuffer
			this._rawBuffer = new Uint8Array(indexBuffer.byteLength + rangeBuffer.byteLength);
			this._rawBuffer.set(new Uint8Array(indexBuffer), 0);
			this._rawBuffer.set(new Uint8Array(rangeBuffer), indexBuffer.byteLength);

			this.audioCtx.decodeAudioData(this._rawBuffer.buffer)
				.then((audioBuffer) => {
					console.log("Decoded");
					yes(this._makeSound(audioBuffer, options))
				}, (err) => {
					no(new Error('Audio decode failed'))
				});
		})
	}

	_destroySound() {
		if (this._sound) {
			this._soundAnalyser.destroy()
			this._sound.destroy()
			this._soundBufferNormalized.fill(0)
			this._soundBufferNormalized = null
			this._analysis = null
		}
	}

	_makeSound(audioBuffer, options) {
		this._destroySound()

		this._sound = Sono.createSound(audioBuffer, options)

		this._sound.on('progress', this._onSoundProgressBound)

		this._soundAnalyser = this._sound.effect.analyser()
		this._analysis = new Analyzer(this._soundAnalyser)

		//this._soundBufferNormalized = BufferUtils.normalize(this._sound.sourceNode.buffer)

		if (options.monitor) {
			this._startUpdate()
		}

		return this._sound
	}

	_startUpdate() {
		let _self = this;
		raf.cancel(this._rafHandle)
		this._rafHandle = raf(function tick() {
			_self.monitor.update()
			raf(tick)
		})
	}

	_onSoundProgress(time) {
		console.log(time);
	}

	on(eventName, callback, userEmitter = true) {
		if (userEmitter) {
			this._emitter.on(eventName, callback)
		} else {
			switch (eventName) {
				case EVENTS.ON_BUFFER_CHUNK:
					this.socket.on(EVENTS.ON_BUFFER_CHUNK, callback)
					break;
			}
		}
	}

	play() {
		if (this._sound) {
			this._sound.play()
		}
	}

	pause() {
		if (this._sound) {
			this._sound.play()
		}
	}

	get monitor() {
		return Monitor
	}

	get analysis() {
		return this._analysis
	}

	getPeaks(options = {}, buffer) {
		buffer = buffer || this._soundBufferNormalized
		return this.analysis.getPeaks(buffer, options)
	}

	setPeaks(peaks) {
		this.monitor.setPeaks(peaks)
	}

	getDrops(options = {}, buffer) {
		buffer = buffer || this._soundBufferNormalized
		return this.analysis.getDrops(buffer, options)
	}

	setDrops(peaks) {
		this.monitor.setDrops(peaks)
	}

	getAmplitude(callback) {
		this._soundAnalyser.getAmplitude(callback)
	}

	get onPeakSignal() {
		return this.monitor.onPeakSignal
	}

	get onDropSignal() {
		return this.monitor.onDropSignal
	}

	get sound() {
		return this._sound
	}

	get soundBuffer() {
		return this._sound.sourceNode.buffer
	}

	get rawBuffer(){
		return this._rawBuffer
	}

	get indexBuffer(){
		return this._indexBuffer
	}

	getBufferSliceFromPercent(start, end) {
		let _dur = this.sound.duration
		let _s = start
		let _e = end
		let _bufferL = this.soundBuffer.length
		let _bs = _bufferL * _s
		let _be = _bufferL * _e
		return BufferUtils.slice(this.soundBuffer, _bs, _be)
	}

	destroy() {
		raf.cancel(this._rafHandle)
	}

}
