/**
 * Heart Rate Sensor
 */
//% color="#d81b60" weight=100 icon="\uf21e" block="Heart Rate"
namespace heartRate {
    /**
     * Read raw analog value from A1.
     */
    //% blockId=heart_rate_raw block="heart rate raw value from A1"
    //% weight=100
    export function raw(): number {
        return pins.A1.analogRead()
    }

    /**
     * Test block.
     */
    //% blockId=heart_rate_test block="heart rate test value"
    //% weight=90
    export function testValue(): number {
        return 123
    }
}
