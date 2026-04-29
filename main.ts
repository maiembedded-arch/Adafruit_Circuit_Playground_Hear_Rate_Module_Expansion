/**
 * Heart Rate Sensor
 */
//% color="#d81b60" weight=100 icon="\uf21e"
namespace heartRate {
    let initialized = false
    let samplerStarted = false

    let rawValue = 0
    let bpmValue = 0
    let ibiValue = 600

    let pulse = false
    let beatEvent = false
    let qsFlag = false

    let imageOutputStep = 0
    let imageBpmValue = 0
    let imageIbiValue = 600

    let rate: number[] = [
        600, 600, 600, 600, 600,
        600, 600, 600, 600, 600
    ]

    let sampleCounter = 0
    let lastBeatTime = 0

    let peakValue = 512
    let troughValue = 512
    let thresholdValue = 512
    let amplitudeValue = 100

    let firstBeat = true
    let secondBeat = false

    let startTimeMs = 0

    function resetValues(): void {
        rawValue = 0
        bpmValue = 0
        ibiValue = 600

        pulse = false
        beatEvent = false
        qsFlag = false

        imageOutputStep = 0
        imageBpmValue = 0
        imageIbiValue = 600

        rate = [
            600, 600, 600, 600, 600,
            600, 600, 600, 600, 600
        ]

        sampleCounter = 0
        lastBeatTime = 0

        peakValue = 512
        troughValue = 512
        thresholdValue = 512
        amplitudeValue = 100

        firstBeat = true
        secondBeat = false

        startTimeMs = control.millis()
    }

    function samplePulseSensor(): void {
        if (!initialized) {
            return
        }

        rawValue = pins.A1.analogRead()

        sampleCounter = control.millis() - startTimeMs

        let N = sampleCounter - lastBeatTime

        if (rawValue < thresholdValue && N > Math.idiv(ibiValue * 3, 5)) {
            if (rawValue < troughValue) {
                troughValue = rawValue
            }
        }

        if (rawValue > thresholdValue && rawValue > peakValue) {
            peakValue = rawValue
        }

        if (N > 250) {
            if (rawValue > thresholdValue && !pulse && N > Math.idiv(ibiValue * 3, 5)) {
                pulse = true

                ibiValue = sampleCounter - lastBeatTime
                lastBeatTime = sampleCounter

                if (secondBeat) {
                    secondBeat = false

                    for (let i = 0; i <= 9; i++) {
                        rate[i] = ibiValue
                    }
                }

                if (firstBeat) {
                    firstBeat = false
                    secondBeat = true
                    return
                }

                let runningTotal = 0

                for (let i = 0; i <= 8; i++) {
                    rate[i] = rate[i + 1]
                    runningTotal += rate[i]
                }

                rate[9] = ibiValue
                runningTotal += rate[9]
                runningTotal = Math.idiv(runningTotal, 10)

                if (runningTotal > 0) {
                    bpmValue = Math.idiv(60000, runningTotal)

                    beatEvent = true
                    qsFlag = true

                    imageBpmValue = bpmValue
                    imageIbiValue = ibiValue
                }
            }
        }

        if (rawValue < thresholdValue && pulse) {
            pulse = false

            amplitudeValue = peakValue - troughValue

            if (amplitudeValue > 20) {
                thresholdValue = Math.idiv(amplitudeValue, 2) + troughValue
            } else {
                thresholdValue = 512
            }

            peakValue = thresholdValue
            troughValue = thresholdValue
        }

        if (N > 2500) {
            thresholdValue = 512
            peakValue = 512
            troughValue = 512

            lastBeatTime = sampleCounter

            firstBeat = true
            secondBeat = false

            pulse = false
            beatEvent = false
            qsFlag = false

            imageOutputStep = 0

            bpmValue = 0
            ibiValue = 600
        }
    }

    /**
     * Initialize heart rate sensor.
     */
    //% blockId=heart_rate_init block="initialize heart rate sensor"
    //% weight=100
    export function init(): void {
        initialized = true
        resetValues()

        if (!samplerStarted) {
            samplerStarted = true

            control.runInParallel(function () {
                while (true) {
                    if (initialized) {
                        samplePulseSensor()
                        pause(2)
                    } else {
                        pause(50)
                    }
                }
            })
        }
    }

    /**
     * Keep this block for compatibility.
     */
    //% blockId=heart_rate_update block="update heart rate sensor"
    //% weight=90
    export function update(): void {
        // Background sampling is already running.
    }

    /**
     * Reset heart rate sensor.
     */
    //% blockId=heart_rate_reset block="reset heart rate sensor"
    //% weight=80
    export function reset(): void {
        resetValues()
    }

    /**
     * Get raw analog value.
     */
    //% blockId=heart_rate_raw block="heart rate raw value"
    //% weight=70
    export function raw(): number {
        return rawValue
    }

    /**
     * Get BPM value.
     */
    //% blockId=heart_rate_bpm block="heart rate BPM"
    //% weight=60
    export function bpm(): number {
        return bpmValue
    }

    /**
     * Get IBI value in milliseconds.
     */
    //% blockId=heart_rate_ibi block="heart rate IBI"
    //% weight=50
    export function ibi(): number {
        return ibiValue
    }

    /**
     * Return true once when heartbeat is detected.
     */
    //% blockId=heart_rate_beat_detected block="heartbeat detected"
    //% weight=40
    export function heartbeatDetected(): boolean {
        let result = beatEvent
        beatEvent = false
        return result
    }

    /**
     * Image output.
     * Compatible with original Pulse Sensor Processing format:
     * S + Signal
     * B + BPM
     * Q + IBI
     */
    //% blockId=heart_rate_image_output block="image output"
    //% weight=30
    export function imageOutput(): string {
        if (imageOutputStep == 1) {
            imageOutputStep = 2
            return "B" + imageBpmValue
        }

        if (imageOutputStep == 2) {
            imageOutputStep = 0
            return "Q" + imageIbiValue
        }

        if (qsFlag) {
            qsFlag = false
            imageOutputStep = 1
        }

        return "S" + rawValue
    }
}
