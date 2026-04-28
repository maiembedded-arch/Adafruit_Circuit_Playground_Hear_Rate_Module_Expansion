/**
 * 心率传感器拓展
 */
//% color="#d81b60" weight=100 block="心率传感器"
namespace heartRate {
    let BPM = 0
    let Signal = 0
    let IBI = 600

    let Pulse = false
    let QS = false

    let rate: number[] = [
        600, 600, 600, 600, 600,
        600, 600, 600, 600, 600
    ]

    let sampleCounter = 0
    let lastBeatTime = 0

    let P = 512
    let T = 512
    let thresh = 512
    let amp = 100

    let firstBeat = true
    let secondBeat = false

    let running = false
    let backgroundCreated = false
    let beatEvent = false

    function readPulseSignal(): number {
        // 固定读取 Circuit Playground 的 A1
        return pins.A1.analogRead()
    }

    function resetVariables(): void {
        BPM = 0
        Signal = 0
        IBI = 600

        Pulse = false
        QS = false

        rate = [
            600, 600, 600, 600, 600,
            600, 600, 600, 600, 600
        ]

        sampleCounter = 0
        lastBeatTime = 0

        P = 512
        T = 512
        thresh = 512
        amp = 100

        firstBeat = true
        secondBeat = false
        beatEvent = false
    }

    function samplePulseSensor(): void {
        Signal = readPulseSignal()

        sampleCounter += 2
        let N = sampleCounter - lastBeatTime

        // 找波谷
        if (Signal < thresh && N > Math.idiv(IBI * 3, 5)) {
            if (Signal < T) {
                T = Signal
            }
        }

        // 找波峰
        if (Signal > thresh && Signal > P) {
            P = Signal
        }

        // 寻找心跳
        if (N > 250) {
            if (Signal > thresh && !Pulse && N > Math.idiv(IBI * 3, 5)) {
                Pulse = true
                IBI = sampleCounter - lastBeatTime
                lastBeatTime = sampleCounter

                if (secondBeat) {
                    secondBeat = false
                    for (let i = 0; i <= 9; i++) {
                        rate[i] = IBI
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

                rate[9] = IBI
                runningTotal += rate[9]
                runningTotal = Math.idiv(runningTotal, 10)

                if (runningTotal > 0) {
                    BPM = Math.idiv(60000, runningTotal)
                    QS = true
                    beatEvent = true
                }
            }
        }

        // 波形回落，重算阈值
        if (Signal < thresh && Pulse) {
            Pulse = false
            amp = P - T
            thresh = Math.idiv(amp, 2) + T
            P = thresh
            T = thresh
        }

        // 太久没检测到，复位
        if (N > 2500) {
            thresh = 512
            P = 512
            T = 512
            lastBeatTime = sampleCounter
            firstBeat = true
            secondBeat = false
        }
    }

    /**
     * 初始化心率传感器，信号脚固定接 A1
     */
    //% blockId=heart_rate_start block="初始化心率传感器 A1"
    //% weight=100
    export function start(): void {
        resetVariables()
        running = true

        if (!backgroundCreated) {
            backgroundCreated = true

            control.inBackground(function () {
                while (true) {
                    if (running) {
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
     * 停止心率传感器采样
     */
    //% blockId=heart_rate_stop block="停止心率传感器"
    //% weight=90
    export function stop(): void {
        running = false
    }

    /**
     * 读取当前原始模拟值
     */
    //% blockId=heart_rate_raw block="心率原始值"
    //% weight=80
    export function raw(): number {
        return Signal
    }

    /**
     * 读取当前 BPM
     */
    //% blockId=heart_rate_bpm block="当前 BPM"
    //% weight=70
    export function bpm(): number {
        return BPM
    }

    /**
     * 读取当前 IBI，单位 ms
     */
    //% blockId=heart_rate_ibi block="当前 IBI"
    //% weight=60
    export function ibi(): number {
        return IBI
    }

    /**
     * 是否检测到新的心跳
     */
    //% blockId=heart_rate_beat_detected block="检测到新心跳"
    //% weight=50
    export function beatDetected(): boolean {
        let result = beatEvent
        beatEvent = false
        return result
    }

    /**
     * 按原 Arduino 程序格式输出串口：
     * S 原始值
     * B BPM
     * Q IBI
     */
    //% blockId=heart_rate_serial_output block="串口输出心率数据"
    //% weight=40
    export function serialOutput(): void {
        serial.writeLine("S" + Signal)

        if (QS) {
            serial.writeLine("B" + BPM)
            serial.writeLine("Q" + IBI)
            QS = false
        }
    }

    /**
     * 手动复位心率算法
     */
    //% blockId=heart_rate_reset block="复位心率算法"
    //% weight=30
    export function reset(): void {
        resetVariables()
    }
}
