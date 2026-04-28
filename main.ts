/**
 * Heart Rate Sensor
 */
//% color="#d81b60" weight=100 icon="\uf21e" block="Heart Rate Sensor"
namespace heartRate {
    let bpmValue = 0
    let rawValue = 0
    let lastBeatMs = 0
    let inHigh = false
    let threshold = 520
    let running = false
    let backgroundCreated = false

    function sample(): void {
        rawValue = pins.A1.analogRead()
        let now = control.millis()

        if (!inHigh && rawValue > threshold) {
            inHigh = true

            if (lastBeatMs > 0) {
                let dt = now - lastBeatMs
                let newBpm = Math.idiv(60000, dt)

                if (newBpm >= 40 && newBpm <= 220) {
                    if (bpmValue == 0) {
                        bpmValue = newBpm
                    } else {
                        bpmValue = Math.idiv(bpmValue * 3 + newBpm, 4)
                    }
                }
            }

            lastBeatMs = now
        }

        if (inHigh && rawValue < threshold - 20) {
            inHigh = false
        }

        if (lastBeatMs > 0 && now - lastBeatMs > 3000) {
            bpmValue = 0
            lastBeatMs = 0
            inHigh = false
        }
    }

    /**
     * Start heart rate sensor sampling on A1.
     */
    //% blockId=heart_rate_start block="start heart rate sensor on A1"
    //% weight=100
    export function start(): void {
        running = true

        if (!backgroundCreated) {
            backgroundCreated = true

            control.inBackground(function () {
                while (true) {
                    if (running) {
                        sample()
                        pause(20)
                    } else {
                        pause(100)
                    }
                }
            })
        }
    }

    /**
     * Get raw analog value from A1.
     */
    //% blockId=heart_rate_raw block="heart rate raw value"
    //% weight=90
    export function raw(): number {
        return rawValue
    }

    /**
     * Get current BPM value.
     */
    //% blockId=heart_rate_bpm block="heart rate BPM"
    //% weight=80
    export function bpm(): number {
        return bpmValue
    }
}
