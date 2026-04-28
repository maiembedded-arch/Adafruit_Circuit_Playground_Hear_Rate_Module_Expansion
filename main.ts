/**
 * Heart Rate Sensor
 */
//% color="#d81b60" weight=100 icon="\uf21e"
namespace heartRate {
    let initialized = false

    /**
     * Initialize heart rate sensor.
     */
    //% blockId=heart_rate_init block="initialize heart rate sensor"
    //% weight=100
    export function init(): void {
        initialized = true
    }
}
