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
    let lastSampleMs = 0

    // 与原版一致的变量
    let peakValue = 512
    let troughValue = 512
    let thresholdValue = 512
    let amplitudeValue = 100

    let firstBeat = true
    let secondBeat = false

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
        lastSampleMs = control.millis()

        peakValue = 512
        troughValue = 512
        thresholdValue = 512
        amplitudeValue = 100

        firstBeat = true
        secondBeat = false
    }

    function samplePulseSensor(): void {
        if (!initialized) {
            return
        }

        rawValue = pins.A1.analogRead()

        // 原版是 Timer2 每 2ms 进一次中断，sampleCounter += 2。
        // MakeCode 的 pause(2) 不一定严格等于 2ms，所以这里用真实 millis 差值更稳。
        let now = control.millis()
        let dt = now - lastSampleMs

        if (dt <= 0) {
            return
        }

        lastSampleMs = now
        sampleCounter += dt

        let N = sampleCounter - lastBeatTime

        // ================= 找波谷 T =================
        // 对应原版：
        // if(Signal < thresh && N > (IBI/5)*3)
        if (rawValue < thresholdValue && N > Math.idiv(ibiValue, 5) * 3) {
            if (rawValue < troughValue) {
                troughValue = rawValue
            }
        }

        // ================= 找波峰 P =================
        // 对应原版：
        // if(Signal > thresh && Signal > P)
        if (rawValue > thresholdValue && rawValue > peakValue) {
            peakValue = rawValue
        }

        // ================= 检测心跳上升沿 =================
        if (N > 250) {
            if (rawValue > thresholdValue && !pulse && N > Math.idiv(ibiValue, 5) * 3) {
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

        // ================= 检测心跳下降沿，并更新自适应阈值 =================
        // 对应原版：
        // if (Signal < thresh && Pulse == true)
        if (rawValue < thresholdValue && pulse) {
            pulse = false

            amplitudeValue = peakValue - troughValue

            // 对应原版：
            // thresh = amp/2 + T
            thresholdValue = Math.idiv(amplitudeValue, 2) + troughValue

            peakValue = thresholdValue
            troughValue = thresholdValue
        }

        // ================= 超时复位 =================
        // 对应原版：
        // if (N > 2500)
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

        // 和原版一致：S 输出原始 Signal，不输出二次校准后的值
        return "S" + rawValue
    }
}
