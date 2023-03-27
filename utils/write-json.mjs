import fs from 'node:fs'
import path from 'node:path'

export default function(json_path, contents){
    fs.writeFileSync(
        path.resolve(json_path), JSON.stringify(contents, null, 4)
    )
}