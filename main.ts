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

    // ================= 自动校准相关 =================
    let calibrating = false
    let calibrateStartMs = 0
    let calibrateMin = 1023
    let calibrateMax = 0

    // 自动校准时间，单位 ms
    const CALIBRATION_TIME_MS = 2000

    // 最小有效波动幅度
    // 原来是 20，你现在信号可能比较窄，先用 10 更容易出 BPM
    const MIN_VALID_AMPLITUDE = 10

    // 无心跳超时时间
    // 原来是 2500，太容易清零，先放宽到 4000
    const NO_BEAT_TIMEOUT_MS = 4000

    function startCalibration(): void {
        calibrating = true
        calibrateStartMs = control.millis()
        calibrateMin = 1023
        calibrateMax = 0

        // 校准期间先用当前 raw 附近作为临时阈值
        thresholdValue = rawValue
        peakValue = rawValue
        troughValue = rawValue
        amplitudeValue = 0

        pulse = false
        beatEvent = false
        qsFlag = false

        firstBeat = true
        secondBeat = false

        imageOutputStep = 0
        bpmValue = 0
        ibiValue = 600
    }

    function finishCalibration(): void {
        amplitudeValue = calibrateMax - calibrateMin

        if (amplitudeValue >= MIN_VALID_AMPLITUDE) {
            troughValue = calibrateMin
            peakValue = calibrateMax
            thresholdValue = Math.idiv(calibrateMin + calibrateMax, 2)
        } else {
            // 如果 2 秒内波动太小，说明可能没有手指或信号太平
            // 不再回到 512，而是用当前原始值附近作为阈值
            thresholdValue = rawValue
            peakValue = rawValue
            troughValue = rawValue
            amplitudeValue = 0
        }

        calibrating = false

        // 关键：校准结束后重新开始计算 IBI
        // 否则第一次 IBI 会把校准时间也算进去
        sampleCounter = control.millis() - startTimeMs
        lastBeatTime = sampleCounter

        pulse = false
        beatEvent = false
        qsFlag = false

        firstBeat = true
        secondBeat = false

        imageOutputStep = 0
        bpmValue = 0
        ibiValue = 600
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

        peakValue = 512
        troughValue = 512
        thresholdValue = 512
        amplitudeValue = 100

        firstBeat = true
        secondBeat = false

        startTimeMs = control.millis()

        startCalibration()
    }

    function samplePulseSensor(): void {
        if (!initialized) {
            return
        }

        rawValue = pins.A1.analogRead()
        sampleCounter = control.millis() - startTimeMs

        // ================= 自动校准阶段 =================
        if (calibrating) {
            if (rawValue < calibrateMin) {
                calibrateMin = rawValue
            }

            if (rawValue > calibrateMax) {
                calibrateMax = rawValue
            }

            if (control.millis() - calibrateStartMs >= CALIBRATION_TIME_MS) {
                finishCalibration()
            }

            return
        }

        let N = sampleCounter - lastBeatTime

        // ================= 更新波谷 =================
        if (rawValue < thresholdValue && N > Math.idiv(ibiValue * 3, 5)) {
            if (rawValue < troughValue) {
                troughValue = rawValue
            }
        }

        // ================= 更新波峰 =================
        if (rawValue > thresholdValue && rawValue > peakValue) {
            peakValue = rawValue
        }

        // ================= 检测心跳上升沿 =================
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

        // ================= 检测心跳下降沿，并更新自适应阈值 =================
        if (rawValue < thresholdValue && pulse) {
            pulse = false

            amplitudeValue = peakValue - troughValue

            if (amplitudeValue >= MIN_VALID_AMPLITUDE) {
                thresholdValue = Math.idiv(amplitudeValue, 2) + troughValue
            } else {
                // 关键修改：
                // 原代码这里会回到 512。
                // 但你的原始信号是 700 多，所以不能回 512。
                thresholdValue = Math.idiv(peakValue + troughValue, 2)
            }

            peakValue = thresholdValue
            troughValue = thresholdValue
        }

        // ================= 长时间没检测到心跳，重新校准 =================
        if (N > NO_BEAT_TIMEOUT_MS) {
            bpmValue = 0
            ibiValue = 600

            pulse = false
            beatEvent = false
            qsFlag = false

            firstBeat = true
            secondBeat = false

            imageOutputStep = 0

            // 不再重置到 512，而是重新做自动校准
            startCalibration()
            lastBeatTime = sampleCounter
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
     * Is sensor calibrating.
     */
    //% blockId=heart_rate_is_calibrating block="heart rate is calibrating"
    //% weight=35
    export function isCalibrating(): boolean {
        return calibrating
    }

    /**
     * Get threshold value.
     */
    //% blockId=heart_rate_threshold block="heart rate threshold"
    //% weight=34
    export function threshold(): number {
        return thresholdValue
    }

    /**
     * Get peak value.
     */
    //% blockId=heart_rate_peak block="heart rate peak"
    //% weight=33
    export function peak(): number {
        return peakValue
    }

    /**
     * Get trough value.
     */
    //% blockId=heart_rate_trough block="heart rate trough"
    //% weight=32
    export function trough(): number {
        return troughValue
    }

    /**
     * Get amplitude value.
     */
    //% blockId=heart_rate_amplitude block="heart rate amplitude"
    //% weight=31
    export function amplitude(): number {
        return amplitudeValue
    }

    /**
     * Debug output.
     */
    //% blockId=heart_rate_debug_output block="heart rate debug output"
    //% weight=29
    export function debugOutput(): string {
        return "S=" + rawValue +
            " T=" + thresholdValue +
            " P=" + peakValue +
            " Tr=" + troughValue +
            " A=" + amplitudeValue +
            " IBI=" + ibiValue +
            " BPM=" + bpmValue +
            " CAL=" + calibrating
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
