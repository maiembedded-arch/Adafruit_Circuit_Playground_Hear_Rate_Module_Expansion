// tests go here; this will not be compiled when this package is used as an extension.
serial.setBaudRate(BaudRate.BaudRate115200)

heartRate.start()

forever(function () {
    heartRate.serialOutput()
    pause(20)
})
