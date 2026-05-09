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

    // 原版 PulseSensor 核心变量
    let peakValue = 512
    let troughValue = 512
    let thresholdValue = 512
    let amplitudeValue = 100

    let firstBeat = true
    let secondBeat = false

    // ================= 启动自适应校准 =================
    let calibrating = false
    let calibrationStartMs = 0
    let calibrationMin = 1023
    let calibrationMax = 0

    let CALIBRATION_TIME_MS = 1000
    let MIN_VALID_AMPLITUDE = 8
    let NO_BEAT_TIMEOUT_MS = 4000

    function startCalibration(): void {
        calibrating = true
        calibrationStartMs = control.millis()
        calibrationMin = 1023
        calibrationMax = 0

        pulse = false
        beatEvent = false
        qsFlag = false

        firstBeat = true
        secondBeat = false

        bpmValue = 0
        ibiValue = 600

        imageOutputStep = 0
        imageBpmValue = 0
        imageIbiValue = 600
    }

    function finishCalibration(): void {
        amplitudeValue = calibrationMax - calibrationMin

        if (amplitudeValue >= MIN_VALID_AMPLITUDE) {
            thresholdValue = Math.idiv(calibrationMin + calibrationMax, 2)
        } else {
            // 波动太小，说明可能没有手指或信号过平
            // 不能回到 512，直接用当前原始值作为中心阈值
            thresholdValue = rawValue
        }

        peakValue = thresholdValue
        troughValue = thresholdValue

        calibrating = false

        // 校准结束后重新开始计时，避免第一次 IBI 把校准时间算进去
        sampleCounter = 0
        lastBeatTime = 0
        lastSampleMs = control.millis()

        pulse = false
        beatEvent = false
        qsFlag = false

        firstBeat = true
        secondBeat = false

        bpmValue = 0
        ibiValue = 600

        imageOutputStep = 0
        imageBpmValue = 0
        imageIbiValue = 600
    }

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

        startCalibration()
    }

    function samplePulseSensor(): void {
        if (!initialized) {
            return
        }

        rawValue = pins.A1.analogRead()

        // ================= 校准阶段 =================
        // 图像输出仍然可以通过 imageOutput() 输出 S + rawValue
        // BPM 暂时不计算
        if (calibrating) {
            if (rawValue < calibrationMin) {
                calibrationMin = rawValue
            }

            if (rawValue > calibrationMax) {
                calibrationMax = rawValue
            }

            if (control.millis() - calibrationStartMs >= CALIBRATION_TIME_MS) {
                finishCalibration()
            }

            return
        }

        let now = control.millis()
        let dt = now - lastSampleMs

        if (dt <= 0) {
            return
        }

        lastSampleMs = now
        sampleCounter += dt

        let N = sampleCounter - lastBeatTime

        // ================= 找波谷 T =================
        if (rawValue < thresholdValue && N > Math.idiv(ibiValue, 5) * 3) {
            if (rawValue < troughValue) {
                troughValue = rawValue
            }
        }

        // ================= 找波峰 P =================
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

        // ================= 心跳下降沿，进行原版自适应阈值更新 =================
        if (rawValue < thresholdValue && pulse) {
            pulse = false

            amplitudeValue = peakValue - troughValue

            if (amplitudeValue >= MIN_VALID_AMPLITUDE) {
                thresholdValue = Math.idiv(amplitudeValue, 2) + troughValue
            } else {
                // 幅度太小时，不要回到 512
                // 用当前峰谷中间值作为临时阈值
                thresholdValue = Math.idiv(peakValue + troughValue, 2)
            }

            peakValue = thresholdValue
            troughValue = thresholdValue
        }

        // ================= 长时间无心跳，重新启动自适应校准 =================
        if (N > NO_BEAT_TIMEOUT_MS) {
            startCalibration()
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
