# zearp-nucintosh-fetcher
Fetch the most recent release from [zearp/Nucintosh](https://github.com/zearp/Nucintosh/releases) and add the missing values in `PlatformInfo`


## Usage

1. Install dependencies with `npm install`

2. Make a copy of `platform-info.example.json` and name it `platform-info.json`. 
Edit the new file with your own values. All values must be strings.
Take a special note for "ROM", it must be a string with no spaces, dots, semicolons, colons. The value will be split into pairs and treat them as hex values.

3. Run `npm run start` and if everything goes right, you get a new copy of _zearp/Nucintosh_ EFI with your own PlatformInfo values.