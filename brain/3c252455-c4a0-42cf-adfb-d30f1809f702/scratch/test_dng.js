const fs = require('fs');
const path = require('path');
const https = require('https');

const dngUrl = 'https://github.com/syoyo/raw-images/raw/master/images/colorchart-iphone7plus-cloudy.dng';
const dngPath = path.join(__dirname, 'sample.dng');

function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        if (fs.existsSync(dest)) {
            return resolve(); // Keep cached
        }
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            if (response.statusCode === 302 || response.statusCode === 301) {
                downloadFile(response.headers.location, dest).then(resolve).catch(reject);
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => {});
            reject(err);
        });
    });
}

async function run() {
    try {
        console.log('Using sample DNG file...');
        await downloadFile(dngUrl, dngPath);
        console.log('Size:', fs.statSync(dngPath).size, 'bytes');

        // Load sharp using absolute path to the backend node_modules
        const sharpPath = 'c:\\Users\\vlado\\Desktop\\admin\\backend\\node_modules\\sharp';
        let sharp;
        try {
            sharp = require(sharpPath);
            console.log('Sharp loaded successfully from:', sharpPath);
        } catch (sharpLoadErr) {
            console.error('Failed to load sharp:', sharpLoadErr.message);
        }

        // Test Method 1: Using sharp directly on DNG
        if (sharp) {
            try {
                console.log('Testing if sharp can read DNG directly...');
                const metadata = await sharp(dngPath).metadata();
                console.log('Sharp metadata:', metadata);
                
                await sharp(dngPath).jpeg().toFile(path.join(__dirname, 'sharp_converted.jpg'));
                console.log('Sharp successfully converted DNG to JPEG directly!');
            } catch (sharpErr) {
                console.log('Sharp failed to read DNG directly:', sharpErr.message);
            }
        }

        // Test Method 2: Pure JS SOI-EOI Scanner
        let largestJpeg;
        try {
            console.log('Testing pure JS SOI-EOI scanner...');
            const buffer = fs.readFileSync(dngPath);
            const jpegs = [];
            
            let i = 0;
            while (i < buffer.length - 1) {
                if (buffer[i] === 0xFF && buffer[i+1] === 0xD8) {
                    const start = i;
                    let end = -1;
                    for (let j = i + 2; j < buffer.length - 1; j++) {
                        if (buffer[j] === 0xFF && buffer[j+1] === 0xD9) {
                            end = j + 2;
                            break;
                        }
                    }
                    if (end !== -1) {
                        const jpegBuf = buffer.slice(start, end);
                        jpegs.push(jpegBuf);
                        i = end - 1;
                    }
                }
                i++;
            }

            if (jpegs.length > 0) {
                jpegs.sort((a, b) => b.length - a.length);
                largestJpeg = jpegs[0];
                const scannerPath = path.join(__dirname, 'scanner_converted.jpg');
                fs.writeFileSync(scannerPath, largestJpeg);
                console.log(`Scanner successfully extracted JPEG of size ${largestJpeg.length} bytes!`);

                if (sharp) {
                    console.log('Testing if sharp can validate the extracted JPEG...');
                    const metadata = await sharp(scannerPath).metadata();
                    console.log('Extracted JPEG metadata parsed by sharp:', metadata);
                }
            } else {
                console.log('Scanner found no JPEGs.');
            }
        } catch (scannerErr) {
            console.log('Scanner failed:', scannerErr);
        }

    } catch (err) {
        console.error('Error running test:', err);
    }
}

run();
