import assistWorker from "assist-worker";
export const encoderToPcmJob = ({ lBuffer, rBuffer, numChannels, size, inputSampleRate, outputSampleRate, oututSampleBits, littleEdian }, workerMethods) => {
    // take out the method in the object containing the worker thread internal control method
    const { postMessage } = workerMethods;
    /**
     * 在data中的offset位置开始写入str字符串
     * @param {TypedArrays} data    二进制数据
     * @param {Number}      offset  偏移量
     * @param {String}      str     字符串
     */
    function writeString(data, offset, str): void {
        for (let i = 0; i < str.length; i++) {
            data.setUint8(offset + i, str.charCodeAt(i));
        }
    }
    function flat(lBuffer,rBuffer,size, numChannels) {
        let lData = null,
            rData = new Float32Array(0);    // 右声道默认为0

        // 创建存放数据的容器
        if (1 === numChannels) {
            lData = new Float32Array(size);
        } else {
            lData = new Float32Array(size / 2);
            rData = new Float32Array(size / 2);
        }
        // 合并
        let offset = 0; // 偏移量计算

        // 将二维数据，转成一维数据
        // 左声道
        for (let i = 0; i < lBuffer.length; i++) {
            lData.set(lBuffer[i], offset);
            offset += lBuffer[i].length;
        }

        offset = 0;
        // 右声道
        for (let i = 0; i < rBuffer.length; i++) {
            rData.set(rBuffer[i], offset);
            offset += rBuffer[i].length;
        }

        return {
            left: lData,
            right: rData
        };
    }

    function compress(data, inputSampleRate: number, outputSampleRate: number) {
        // 压缩，根据采样率进行压缩
        let rate = inputSampleRate / outputSampleRate,
            compression = Math.max(rate, 1),
            lData = data.left,
            rData = data.right,
            length = Math.floor((lData.length + rData.length) / rate),
            result = new Float32Array(length),
            index = 0,
            j = 0;

        // 循环间隔 compression 位取一位数据
        while (index < length) {
            // 取整是因为存在比例compression不是整数的情况
            let temp = Math.floor(j);

            result[index] = lData[temp];
            index++;

            if (rData.length) {
                /*
                * 双声道处理
                * e.inputBuffer.getChannelData(0)得到了左声道4096个样本数据，1是右声道的数据，
                * 此处需要组和成LRLRLR这种格式，才能正常播放，所以要处理下
                */
                result[index] = rData[temp];
                index++;
            }

            j += compression;
        }
        // 返回压缩后的一维数据
        return result;
    }

    function encodePCM(bytes, sampleBits: number, littleEdian: boolean = true) {
        let offset = 0,
            dataLength = bytes.length * (sampleBits / 8),
            buffer = new ArrayBuffer(dataLength),
            data = new DataView(buffer);

        // 写入采样数据
        if (sampleBits === 8) {
            for (let i = 0; i < bytes.length; i++, offset++) {
                // 范围[-1, 1]
                let s = Math.max(-1, Math.min(1, bytes[i]));
                // 8位采样位划分成2^8=256份，它的范围是0-255;
                // 对于8位的话，负数*128，正数*127，然后整体向上平移128(+128)，即可得到[0,255]范围的数据。
                let val = s < 0 ? s * 128 : s * 127;
                val = +val + 128;
                data.setInt8(offset, val);
            }
        } else {
            for (let i = 0; i < bytes.length; i++, offset += 2) {
                let s = Math.max(-1, Math.min(1, bytes[i]));
                // 16位的划分的是2^16=65536份，范围是-32768到32767
                // 因为我们收集的数据范围在[-1,1]，那么你想转换成16位的话，只需要对负数*32768,对正数*32767,即可得到范围在[-32768,32767]的数据。
                data.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, littleEdian);
            }
        }

        return data;
    }

    function encodeWAV(bytes: any, inputSampleRate: number, outputSampleRate: number, numChannels: number, oututSampleBits: number, littleEdian: boolean = true) {
        let sampleRate = outputSampleRate > inputSampleRate ? inputSampleRate : outputSampleRate,   // 输出采样率较大时，仍使用输入的值，
            sampleBits = oututSampleBits,
            buffer = new ArrayBuffer(44 + bytes.byteLength),
            data = new DataView(buffer),
            channelCount = numChannels, // 声道
            offset = 0;

        // 资源交换文件标识符
        writeString(data, offset, 'RIFF'); offset += 4;
        // 下个地址开始到文件尾总字节数,即文件大小-8
        data.setUint32(offset, 36 + bytes.byteLength, littleEdian); offset += 4;
        // WAV文件标志
        writeString(data, offset, 'WAVE'); offset += 4;
        // 波形格式标志
        writeString(data, offset, 'fmt '); offset += 4;
        // 过滤字节,一般为 0x10 = 16
        data.setUint32(offset, 16, littleEdian); offset += 4;
        // 格式类别 (PCM形式采样数据)
        data.setUint16(offset, 1, littleEdian); offset += 2;
        // 声道数
        data.setUint16(offset, channelCount, littleEdian); offset += 2;
        // 采样率,每秒样本数,表示每个通道的播放速度
        data.setUint32(offset, sampleRate, littleEdian); offset += 4;
        // 波形数据传输率 (每秒平均字节数) 声道数 × 采样频率 × 采样位数 / 8
        data.setUint32(offset, channelCount * sampleRate * (sampleBits / 8), littleEdian); offset += 4;
        // 快数据调整数 采样一次占用字节数 声道数 × 采样位数 / 8
        data.setUint16(offset, channelCount * (sampleBits / 8), littleEdian); offset += 2;
        // 采样位数
        data.setUint16(offset, sampleBits, littleEdian); offset += 2;
        // 数据标识符
        writeString(data, offset, 'data'); offset += 4;
        // 采样数据总数,即数据总大小-44
        data.setUint32(offset, bytes.byteLength, littleEdian); offset += 4;

        // 给wav头增加pcm体
        for (let i = 0; i < bytes.byteLength;) {
            data.setUint8(offset, bytes.getUint8(i));
            offset++;
            i++;
        }

        return data;
    }

    const {left,right} = flat(lBuffer, rBuffer, size, numChannels)
    let data = compress({
        left: left,
        right: right,
    }, inputSampleRate, outputSampleRate);

    const result = encodePCM(data, oututSampleBits, littleEdian)
    const wav = encodeWAV(result, inputSampleRate, outputSampleRate, numChannels, oututSampleBits, littleEdian)
    console.debug('处理好了数据', wav)
    postMessage(wav)
};
