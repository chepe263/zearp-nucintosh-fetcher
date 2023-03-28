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
const zearp_zip_dirname = 'zearp_release_zip'
const oc_resources_zip_dirname = 'oc_resource_zip'
const oc_binary_zip_dirname = 'oc_binary_zip'

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
    let repo_releases = await octokid.request('GET /repos/{owner}/{repo}/releases', {
        owner: "zearp",
        repo: "Nucintosh"
    })
    const zip_url = _.head(_.head(repo_releases.data).assets).browser_download_url
    const zip_filename = _.head(_.head(repo_releases.data).assets).name
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
 * Get the release information for acidanthera/OpenCorePkg and return the zip url, filename and output path for zip download
 * @returns {Object}
 */
async function download_and_copy_oc_binary_releases() {
    const octokid = new Octokit();
    let repo_releases = await octokid.request('GET /repos/{owner}/{repo}/releases', {
        owner: "acidanthera",
        repo: "OpenCorePkg"
    })
    write_json(path.resolve(output_dir_path, 'download_and_copy_oc_binary_releases.json'), repo_releases)
    const first_release = _.head(_.filter(_.head(repo_releases.data).assets, o => {
        return o.name.includes("RELEASE")
    }));
    const zip_url = first_release.browser_download_url
    const zip_filename = first_release.name
    const output_path = path.resolve(output_dir_path, zip_filename)

    await download_zip(zip_filename, zip_url, output_path)
    await unzip_all(zip_filename, output_path, oc_binary_zip_dirname);
    fs.copyFileSync(
        path.resolve(output_dir_path, oc_binary_zip_dirname, "X64/EFI/OC/OpenCore.efi"),
        path.resolve(output_dir_path, zearp_zip_dirname, "EFI/OC/OpenCore.efi")
    )
    fs.copyFileSync(
        path.resolve(output_dir_path, oc_binary_zip_dirname, "X64/EFI/OC/Drivers/OpenCanopy.efi"),
        path.resolve(output_dir_path, zearp_zip_dirname, "EFI/OC/Drivers/OpenCanopy.efi")
    )
    /**
     * @todo 
     * descargar el zip de releases
     * copiar el opencanopy a drivers
     * y configurar el config.plist para que use el gui
     */
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
 * Get the release information for acidanthera/OcBinaryData and return the zip url, filename and output path for zip download
 * @returns {Object}
 */
async function download_and_copy_oc_resources() {
    const octokid = new Octokit();
    let repo_info = await octokid.request('GET /repos/{owner}/{repo}/zipball', {
        owner: "acidanthera",
        repo: "OcBinaryData"
    })
    //const buffer = Buffer.from(repo_info.data);
    const zip_filename = 'oc_resources.zip'
    let outputFileName = path.resolve(output_dir_path, zip_filename)
    //fs.writeFileSync(outputFileName, buffer.toString())
    fs.appendFileSync(outputFileName, Buffer.from(repo_info.data));
    //await fs.createWriteStream(outputFileName).write(buffer);
    await unzip_all(zip_filename, outputFileName, oc_resources_zip_dirname);
    let first_folder = fs.readdirSync(path.resolve(output_dir_path, oc_resources_zip_dirname))
    let new_path_inside_zip = path.resolve(output_dir_path, oc_resources_zip_dirname, _.head(first_folder))
    let efi_path_base = path.resolve(output_dir_path, zearp_zip_dirname,  'EFI/OC')
    if(fs.existsSync(efi_path_base)){
        fs.cpSync(path.resolve(new_path_inside_zip, 'Resources'), path.resolve(efi_path_base, 'Resources'), {recursive: true})
    }
    // const zip_url = _.head(_.head(zearp_releases.data).assets).browser_download_url
    // const zip_filename = _.head(_.head(zearp_releases.data).assets).name
    // const output_path = path.resolve(output_dir_path, zip_filename)

    // fs.writeFileSync(
    //     path.resolve(path.dirname('.'), './out/releases.json'), JSON.stringify(zearp_releases, null, 4)
    // )
    return repo_info
}

/**
 * Download the zip from github and place it in {output_path} (out)
 * @param {String} zip_filename - the filename for the zip EFI_DDMMYYY.zip
 * @param {String} zip_url - the url to download the zip from github
 * @param {String} output_path - the path to download the zip, inside "out" directory
 */
async function download_zip(zip_filename, zip_url, output_path) {
    console.log("downloading ", zip_filename, "from", zip_url);
    await downloadFile(zip_url, output_path)
    //console.log(_.head(zerp.data).assets)

    console.log("downloading ", zip_filename, "Done!")

}

/**
 * Unzip the downloaded zip from zearp/nucintosh releases
 * @param {String} zip_filename 
 * @param {String} zip_path 
 * @param {String} folder_out - The name of the folder to unzip 
 */
async function unzip_all(zip_filename, zip_path, folder_out) {
    console.log("unzip ", zip_filename, "in", zip_path)
    let zip = new AdmZip(zip_path);
    let zipEntries = zip.getEntries();
    //console.log(zipEntries)
    zip.extractAllTo(path.resolve(output_dir_path, folder_out))

}

/**
 * Place the correct values for OC confi.plist "PlatformInfo"
 */
async function update_platform_info() {
    // @todo check if platform-info.json exists
    console.log("Read platform info and replace values in EFI/OC/config.plist")
    const platform_info = JSON.parse(fs.readFileSync(path.resolve(path.dirname('.'), './platform-info.json')))
    const config_plist_path = path.resolve(output_dir_path, zearp_zip_dirname, 'EFI/OC/config.plist')
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
    const config_plist_path = path.resolve(output_dir_path, zearp_zip_dirname, 'EFI/OC/config.plist')
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
    const config_plist_path = path.resolve(output_dir_path, zearp_zip_dirname, 'EFI/OC/Kexts/USBPorts.kext/Contents/Info.plist');
    let config = plist.parse(fs.readFileSync(config_plist_path, 'utf8'));
    delete config.IOKitPersonalities["_SB.PCI0.XHC"].IOProviderMergeProperties.ports.HS07
    fs.writeFileSync(
        path.resolve(config_plist_path), plist.build(config)
    )
}

function disable_debug(){
    const config_plist_path = path.resolve(output_dir_path, zearp_zip_dirname, 'EFI/OC/config.plist')
    let config = plist.parse(fs.readFileSync(config_plist_path, 'utf8'));
    config.Misc.Debug.AppleDebug = false;
    config.NVRAM.Add["7C436110-AB2A-4BBB-A880-FE41995C9F82"]["boot-args"] = config.NVRAM.Add["7C436110-AB2A-4BBB-A880-FE41995C9F82"]["boot-args"].replace('-v', '').trim();
    config.Misc.Debug.Target = 3;
    //console.log(config.NVRAM.Add["7C436110-AB2A-4BBB-A880-FE41995C9F82"]["boot-args"].replace('-v', '').trim())
    fs.writeFileSync(
        path.resolve(config_plist_path), plist.build(config)
    )
}
async function add_gui(){
    // let oc_binary_info = await get_oc_binary_releases()
    // console.log(oc_binary_info)
    await download_and_copy_oc_resources();
    await download_and_copy_oc_binary_releases();

    //// do the gui config!
    const config_plist_path = path.resolve(output_dir_path, zearp_zip_dirname, 'EFI/OC/config.plist')
    let config = plist.parse(fs.readFileSync(config_plist_path, 'utf8'));
    config.Misc.Boot.PickerMode = 'External';
    config.Misc.Boot.PickerAttributes = 17;
    config.Misc.Boot.PickerVariant = 'Acidanthera\\GoldenGate';
    let add_opencanopy = true;
    for(let i = 0; i < config.UEFI.Drivers.length; i++){
        if(config.UEFI.Drivers[i].Path.includes('OpenCanopy')){
            add_opencanopy = false;
            break;
        }
    }
    if(add_opencanopy){
        config.UEFI.Drivers.push(
            {
              Arguments: '',
              Comment: 'OpenCanopy.efi',
              Enabled: true,
              LoadEarly: false,
              Path: 'OpenCanopy.efi'
            },)
    }
    fs.writeFileSync(
        path.resolve(config_plist_path), plist.build(config)
    )

    //console.log(config.UEFI.Drivers)
}


/**
 * Do everything at once!
 */
async function init() {
    await cleanup()
    let release_zerp = await get_zearp_releases();
    await download_zip(release_zerp.zip_filename, release_zerp.zip_url, release_zerp.output_path)
    await unzip_all(release_zerp.zip_filename, release_zerp.output_path, zearp_zip_dirname);
    await update_platform_info();
    disable_kexts();
    adjust_usb_map();
    disable_debug();
    add_gui();
}



init()
