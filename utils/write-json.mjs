export default function(json_path, contents){
    fs.writeFileSync(
        path.resolve(json_path), JSON.stringify(contents, null, 4)
    )
}