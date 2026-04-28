/**
 * Heart Rate Sensor
 */
//% color="#d81b60" weight=100 icon="\uf21e"
namespace heartRate {
    let BPM = 0
    let Signal = 0
    let IBI = 600

    let Pulse = false
    let beatEvent = false

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

    function resetVariables(): void {
        BPM = 0
        Signal = 0
        IBI = 600

        Pulse = false
        beatEvent = false

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
    }

    function samplePulseSensor(): void {
        Signal = pins.A1.analogRead()

        sampleCounter += 2
        let N = sampleCounter - lastBeatTime

        if (Signal < thresh && N > Math.idiv(IBI * 3, 5)) {
            if (Signal < T) {
                T = Signal
            }
        }

        if (Signal > thresh && Signal > P) {
            P = Signal
        }

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
                    beatEvent = true
                }
            }
        }

        if (Signal < thresh && Pulse) {
            Pulse = false
            amp = P - T
            thresh = Math.idiv(amp, 2) + T
            P = thresh
            T = thresh
        }

        if (N > 2500) {
            thresh = 512
            P = 512
            T = 512
            lastBeatTime = sampleCounter
            firstBeat = true
            secondBeat = false
            BPM = 0
            IBI = 600
        }
    }

    /**
     * Start heart rate sensor sampling on A1.
     */
    //% blockId=heart_rate_start block="start heart rate sensor on A1"
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
     * Stop heart rate sensor sampling.
     */
    //% blockId=heart_rate_stop block="stop heart rate sensor"
    //% weight=90
    export function stop(): void {
        running = false
    }

    /**
     * Get raw analog value from A1.
     */
    //% blockId=heart_rate_raw block="heart rate raw value"
    //% weight=80
    export function raw(): number {
        return Signal
    }

    /**
     * Get current BPM value.
     */
    //% blockId=heart_rate_bpm block="heart rate BPM"
    //% weight=70
    export function bpm(): number {
        return BPM
    }

    /**
     * Get current IBI value in ms.
     */
    //% blockId=heart_rate_ibi block="heart rate IBI"
    //% weight=60
    export function ibi(): number {
        return IBI
    }

    /**
     * Return true once when a new heartbeat is detected.
     */
    //% blockId=heart_rate_beat_detected block="heartbeat detected"
    //% weight=50
    export function beatDetected(): boolean {
        let result = beatEvent
        beatEvent = false
        return result
    }

    /**
     * Reset heart rate algorithm.
     */
    //% blockId=heart_rate_reset block="reset heart rate algorithm"
    //% weight=40
    export function reset(): void {
        resetVariables()
    }
}
