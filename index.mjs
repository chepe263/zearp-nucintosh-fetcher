import axios from 'axios';
import { Octokit } from "octokit";
import fs from 'node:fs'
import path from 'node:path';
import _ from 'lodash';
import downloadFile from './utils/download-file.mjs'
import AdmZip from 'adm-zip'
import plist from 'plist'
import hexStrToBuffer from './utils/hex-str-to-buffer.mjs';
import write_json from './utils/write-json.mjs'

const output_dir_path = path.resolve(path.dirname('.'), `./out/`)
const output_zip_dirname = 'zearp_release_zip'

/**
 * Delete "out" folder and create a new one
 */
async function cleanup() {
    if (fs.existsSync(output_dir_path)) {
        console.log("must delete out dir")
        fs.rmSync(output_dir_path, { recursive: true })
    }
    fs.mkdirSync(output_dir_path)
}

/**
 * Get the release information for zearp/nucintosh and return the zip url, filename and output path for zip download
 * @returns {Object}
 */
async function get_zearp_releases() {
    const octokid = new Octokit();
    let zearp_releases = await octokid.request('GET /repos/{owner}/{repo}/releases', {
        owner: "zearp",
        repo: "Nucintosh"
    })
    const zip_url = _.head(_.head(zearp_releases.data).assets).browser_download_url
    const zip_filename = _.head(_.head(zearp_releases.data).assets).name
    const output_path = path.resolve(output_dir_path, zip_filename)

    // fs.writeFileSync(
    //     path.resolve(path.dirname('.'), './out/releases.json'), JSON.stringify(zearp_releases, null, 4)
    // )
    return {
        zip_url,
        zip_filename,
        output_path
    }

}

/**
 * Download the zip from github and place it in {output_path} (out)
 * @param {String} zip_filename - the filename for the zip EFI_DDMMYYY.zip
 * @param {String} zip_url - the url to download the zip from github
 * @param {String} output_path - the path to download the zip, inside "out" directory
 */
async function download_zearp(zip_filename, zip_url, output_path) {
    console.log("downloading ", zip_filename, "from", zip_url);
    await downloadFile(zip_url, output_path)
    //console.log(_.head(zerp.data).assets)

    console.log("downloading ", zip_filename, "Done!")

}

/**
 * Unzip the downloaded zip from zearp/nucintosh releases
 * @param {String} zip_filename 
 * @param {String} zip_path 
 */
async function unzip_zearp(zip_filename, zip_path) {
    console.log("unzip ", zip_filename, "in", zip_path)
    let zip = new AdmZip(zip_path);
    let zipEntries = zip.getEntries();
    // console.log(zipEntries)
    zip.extractAllTo(path.resolve(output_dir_path, output_zip_dirname))

}

/**
 * Place the correct values for OC confi.plist "PlatformInfo"
 */
async function update_platform_info() {
    // @todo check if platform-info.json exists
    console.log("Read platform info and replace values in EFI/OC/config.plist")
    const platform_info = JSON.parse(fs.readFileSync(path.resolve(path.dirname('.'), './platform-info.json')))
    const config_plist_path = path.resolve(output_dir_path, output_zip_dirname, 'EFI/OC/config.plist')
    let new_rom = hexStrToBuffer(platform_info.ROM);
    let config = plist.parse(fs.readFileSync(config_plist_path, 'utf8'));
     write_json(path.resolve(output_dir_path, 'config-plist.json'), config)
    config.PlatformInfo.Generic.ROM = new_rom
    //config.PlatformInfo.Generic.ROM.data.push(...new_rom)
    config.PlatformInfo.Generic.MLB = platform_info.MLB
    config.PlatformInfo.Generic.SystemSerialNumber = platform_info.SystemSerialNumber
    config.PlatformInfo.Generic.SystemUUID = platform_info.SystemUUID
     write_json(path.resolve(output_dir_path, 'config-plist-after.json'), config)
     // fs.writeFileSync(path.resolve(output_dir_path, 'new-config.plist'), plist.build(config))
    /**
     * @todo el resultado de build cambia etiquetas vacias
     *  <string></string> por <string/>
     *  <data></data> por <data/>
     * quiza reemplazar si hace algun problema??
     */
    fs.writeFileSync(
        path.resolve(config_plist_path), plist.build(config)
    )
    //console.log("rom", new_rom,platform_info)
    //console.log(config)
}

/**
 * Disable intel wifi and bluetooth kexts, also NVMEfix
 */
function disable_kexts(){
    let disable_kexts = [ // BundlePath
        "BlueToolFixup.kext",
        "IntelBluetoothFirmware.kext",
        "AirportItlwm.kext",
        "NVMeFix.kext",
    ];
    console.log("Disable several kexts in config (",disable_kexts.join(", "),")")
    const config_plist_path = path.resolve(output_dir_path, output_zip_dirname, 'EFI/OC/config.plist')
    let config = plist.parse(fs.readFileSync(config_plist_path, 'utf8'));
    for(let i = 0; i < config.Kernel.Add.length; i++){
        if(disable_kexts.includes(config.Kernel.Add[i].BundlePath)  ){
            config.Kernel.Add[i].Enabled = false;
        }
    }
    fs.writeFileSync(
        path.resolve(config_plist_path), plist.build(config)
    )
}

function adjust_usb_map(){
    console.log("Remove HS07 config block from USBMap");
    const config_plist_path = path.resolve(output_dir_path, output_zip_dirname, 'EFI/OC/Kexts/USBPorts.kext/Contents/Info.plist');
    let config = plist.parse(fs.readFileSync(config_plist_path, 'utf8'));
    delete config.IOKitPersonalities["_SB.PCI0.XHC"].IOProviderMergeProperties.ports.HS07
    fs.writeFileSync(
        path.resolve(config_plist_path), plist.build(config)
    )
}

function add_gui(){
    const config_plist_path = path.resolve(output_dir_path, output_zip_dirname, 'EFI/OC/config.plist')
    let config = plist.parse(fs.readFileSync(config_plist_path, 'utf8'));
    config.Misc.Debug.AppleDebug = false;
    config.NVRAM.Add["7C436110-AB2A-4BBB-A880-FE41995C9F82"]["boot-args"] = config.NVRAM.Add["7C436110-AB2A-4BBB-A880-FE41995C9F82"]["boot-args"].replace('-v', '').trim();
    config.Misc.Debug.Target = 3;
    //console.log(config.NVRAM.Add["7C436110-AB2A-4BBB-A880-FE41995C9F82"]["boot-args"].replace('-v', '').trim())
    fs.writeFileSync(
        path.resolve(config_plist_path), plist.build(config)
    )
}


/**
 * Do everything at once!
 */
async function init() {
    await cleanup()
    let release_zerp = await get_zearp_releases();
    await download_zearp(release_zerp.zip_filename, release_zerp.zip_url, release_zerp.output_path)
    await unzip_zearp(release_zerp.zip_filename, release_zerp.output_path);
    await update_platform_info();
    disable_kexts();
    adjust_usb_map();
    //add_gui();
}



init()
