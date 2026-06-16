//% color="#00BCD4" weight=100 icon="\uf140" block="公式完全移植・2連VL53L0X"
namespace doubleVL53L0X {
    const ADDR_A = 0x30; // センサーAの変更後アドレス
    const ADDR_B = 0x29; // センサーBのアドレス（初期値）

    // 公式ライブラリが内部で使っている、データを1バイト書き込む関数
    function ioWriteByte(addr: number, reg: number, value: number): void {
        let buffer = pins.createBuffer(2);
        buffer.setNumber(NumberFormat.UInt8LE, 0, reg);
        buffer.setNumber(NumberFormat.UInt8LE, 1, value);
        pins.i2cWriteBuffer(addr, buffer);
    }

    // 公式ライブラリが内部で使っている、データを1バイト読み込む関数
    function ioReadByte(addr: number, reg: number): number {
        pins.i2cWriteNumber(addr, reg, NumberFormat.UInt8LE, true);
        return pins.i2cReadNumber(addr, NumberFormat.UInt8LE, false);
    }

    // 公式の「initialise」の内部処理を完全に再現した関数
    function official_init(addr: number): boolean {
        // センサーが生きているか、識別ID(0xC0)を確認する公式の手順
        if (ioReadByte(addr, 0xC0) != 0xEE) {
            return false; 
        }

        // 公式が実行している、センサーを起動・キャリブレーションするレジスタ設定一式
        ioWriteByte(addr, 0x88, 0x00);
        ioWriteByte(addr, 0x80, 0x01);
        ioWriteByte(addr, 0xFF, 0x01);
        ioWriteByte(addr, 0x00, 0x00);
        let stop_variable = ioReadByte(addr, 0x91);
        ioWriteByte(addr, 0x00, 0x01);
        ioWriteByte(addr, 0xFF, 0x00);
        ioWriteByte(addr, 0x80, 0x00);

        ioWriteByte(addr, 0x60, ioReadByte(addr, 0x60) | 0x12);
        ioWriteByte(addr, 0x01, ioReadByte(addr, 0x01) | 0x40);

        // VHV（自動電圧調整）とフェーズキャリブレーション
        ioWriteByte(addr, 0x0B, 0x01);
        ioWriteByte(addr, 0x00, 0x01); // 測定開始トリガー

        // 連続測定モードを正式に開始する公式コマンド
        ioWriteByte(addr, 0xFF, 0x01);
        ioWriteByte(addr, 0x4F, 0x00);
        ioWriteByte(addr, 0x4E, 0x2C);
        ioWriteByte(addr, 0xFF, 0x00);
        ioWriteByte(addr, 0x00, 0x02); // 連続モードON

        return true;
    }

    /**
     * 【本番用】公式と全く同じ手順で2つのセンサーを順番に起動し、初期化します。
     */
    //% block="【本番用】2連センサーを初期化する XSHUT_A %pinA XSHUT_B %pinB"
    export function initDoubleSensors(pinA: DigitalPin, pinB: DigitalPin): void {
        // 1. いったん両方を眠らせる
        pins.digitalWritePin(pinA, 0);
        pins.digitalWritePin(pinB, 0);
        basic.pause(50);

        // 2. センサーAだけを起こす
        pins.digitalWritePin(pinA, 1);
        basic.pause(50);

        // 3. センサーAのアドレスを「0x30」に書き換える
        ioWriteByte(0x29, 0x22, ADDR_A);
        basic.pause(10);

        // 4. アドレスを変えたセンサーAを公式手順で初期化
        official_init(ADDR_A);

        // 5. センサーBを起こす（0x29のまま起きてくる）
        pins.digitalWritePin(pinB, 1);
        basic.pause(50);

        // 6. センサーBを公式手順で初期化
        official_init(ADDR_B);
    }

    /**
     * 【本番用】センサーA（アドレス: 0x30）の距離を取得します（mm）
     */
    //% block="センサーAの距離 (mm)"
    export function getDistanceA(): number {
        pins.i2cWriteNumber(ADDR_A, 0x14, NumberFormat.UInt8LE, true);
        let buf = pins.i2cReadBuffer(ADDR_A, 12);
        let dist = (buf.getUint8(10) << 8) | buf.getUint8(11);
        if (dist > 8000 || dist <= 20) return 0;
        return dist;
    }

    /**
     * 【本番用】センサーB（アドレス: 0x29）の距離を取得します（mm）
     */
    //% block="センサーBの距離 (mm)"
    export function getDistanceB(): number {
        pins.i2cWriteNumber(ADDR_B, 0x14, NumberFormat.UInt8LE, true);
        let buf = pins.i2cReadBuffer(ADDR_B, 12);
        let dist = (buf.getUint8(10) << 8) | buf.getUint8(11);
        if (dist > 8000 || dist <= 20) return 0;
        return dist;
    }
}

//% color="#4185E6" weight=90 icon="\uf00a" block="MCP23017拡張"
namespace mcp23017 {
    const MCP23017_ADDR = 0x20;
    const IODIRA = 0x00; const IODIRB = 0x01;
    const GPIOA = 0x12;  const GPIOB = 0x13;
    
    function writeReg(reg: number, val: number): void {
        let buf = pins.createBuffer(2);
        buf.setNumber(NumberFormat.UInt8LE, 0, reg);
        buf.setNumber(NumberFormat.UInt8LE, 1, val);
        pins.i2cWriteBuffer(MCP23017_ADDR, buf);
    }

    //% block="MCP23017を初期化する"
    export function init(): void {
        writeReg(IODIRA, 0x00); writeReg(IODIRB, 0x00);
        writeReg(GPIOA, 0x00); writeReg(GPIOB, 0x00);
    }
}