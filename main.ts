/**
 * Heart Rate Sensor
 */
//% color="#d81b60" weight=100 icon="\uf21e"
namespace heartRate {
    let initialized = false
    let samplerStarted = false

    // 原始 ADC 值
    let rawValue = 0

    // 统一校准后的信号值
    // 图像输出和 BPM 算法都使用这个值
    let signalValue = 512

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

    // BPM 算法使用的是 signalValue，所以阈值可以继续围绕 512 工作
    let peakValue = 512
    let troughValue = 512
    let thresholdValue = 512
    let amplitudeValue = 100

    let firstBeat = true
    let secondBeat = false

    let startTimeMs = 0

    // ================= 统一信号校准 =================
    let calibrationReady = false

    let calWindowStartMs = 0
    let calMin = 1023
    let calMax = 0

    // 原始信号中心点
    // 比如你的原始信号 700 多，这个值会自动靠近 700 多
    let signalMid = 512

    // 原始信号幅度
    let signalAmp = 100

    // 校准窗口时间
    let CAL_WINDOW_MS = 1000

    // 最小有效幅度
    let MIN_VALID_AMPLITUDE = 8

    // 长时间没检测到心跳后，只重置 BPM 状态，不重置校准中心
    let NO_BEAT_TIMEOUT_MS = 4000

    function clampSignal(v: number): number {
        if (v < 0) {
            return 0
        }

        if (v > 1023) {
            return 1023
        }

        return v
    }

    function resetBeatState(): void {
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

        peakValue = 512
        troughValue = 512
        thresholdValue = 512
        amplitudeValue = 100

        firstBeat = true
        secondBeat = false

        sampleCounter = control.millis() - startTimeMs
        lastBeatTime = sampleCounter
    }

    function resetCalibration(): void {
        calibrationReady = false

        calWindowStartMs = control.millis()
        calMin = 1023
        calMax = 0

        signalMid = 512
        signalAmp = 100
        signalValue = 512
    }

    function updateUnifiedCalibration(): void {
        // 第一次采样时，直接用当前 raw 作为中心，避免 700 多的信号一开始就高于 512
        if (calMin == 1023 && calMax == 0) {
            calMin = rawValue
            calMax = rawValue
            signalMid = rawValue
        }

        if (rawValue < calMin) {
            calMin = rawValue
        }

        if (rawValue > calMax) {
            calMax = rawValue
        }

        let now = control.millis()

        if (now - calWindowStartMs >= CAL_WINDOW_MS) {
            let windowAmp = calMax - calMin
            let windowMid = Math.idiv(calMax + calMin, 2)

            if (windowAmp >= MIN_VALID_AMPLITUDE) {
                if (calibrationReady) {
                    // 慢速跟随，防止阈值跳动太大
                    signalMid = Math.idiv(signalMid * 3 + windowMid, 4)
                    signalAmp = Math.idiv(signalAmp * 3 + windowAmp, 4)
                } else {
                    // 第一次有效校准
                    signalMid = windowMid
                    signalAmp = windowAmp
                    calibrationReady = true
                    resetBeatState()
                }
            } else {
                // 波动太小，说明可能没有手指或信号太平
                // 不乱改 BPM 状态，只让图像和 BPM 继续基于当前中心工作
                if (!calibrationReady) {
                    signalMid = rawValue
                }
            }

            calMin = rawValue
            calMax = rawValue
            calWindowStartMs = now
        }

        // 统一校准输出：
        // 把 700 多的原始信号平移到 512 附近
        // 图像输出和 BPM 都用这个 signalValue
        signalValue = clampSignal(rawValue - signalMid + 512)
    }

    function resetValues(): void {
        rawValue = 0
        signalValue = 512

        startTimeMs = control.millis()

        resetCalibration()
        resetBeatState()
    }

    function samplePulseSensor(): void {
        if (!initialized) {
            return
        }

        rawValue = pins.A1.analogRead()
        sampleCounter = control.millis() - startTimeMs

        // 先做统一校准
        updateUnifiedCalibration()

        // 校准还没准备好时，只输出图像 S 信号，不计算 BPM
        if (!calibrationReady) {
            return
        }

        let N = sampleCounter - lastBeatTime

        // ================= 更新波谷 =================
        if (signalValue < thresholdValue && N > Math.idiv(ibiValue * 3, 5)) {
            if (signalValue < troughValue) {
                troughValue = signalValue
            }
        }

        // ================= 更新波峰 =================
        if (signalValue > thresholdValue && signalValue > peakValue) {
            peakValue = signalValue
        }

        // ================= 检测心跳上升沿 =================
        if (N > 250) {
            if (signalValue > thresholdValue && !pulse && N > Math.idiv(ibiValue * 3, 5)) {
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
        if (signalValue < thresholdValue && pulse) {
            pulse = false

            amplitudeValue = peakValue - troughValue

            if (amplitudeValue >= MIN_VALID_AMPLITUDE) {
                thresholdValue = Math.idiv(amplitudeValue, 2) + troughValue
            } else {
                // 校准后的信号中心是 512，所以这里不要回原始 700 多
                thresholdValue = 512
            }

            peakValue = thresholdValue
            troughValue = thresholdValue
        }

        // ================= 长时间无心跳，只重置心跳识别状态 =================
        if (N > NO_BEAT_TIMEOUT_MS) {
            resetBeatState()
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

        return "S" + signalValue
    }
}
