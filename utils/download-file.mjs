import * as stream from 'stream';
import { promisify } from 'util';
import fs from 'node:fs';
import axios from 'axios';

const finished = promisify(stream.finished);

// https://stackoverflow.com/a/61269447
export default async function(fileUrl, outputLocationPath){
  const writer = fs.createWriteStream(outputLocationPath);
  return axios({
    method: 'get',
    url: fileUrl,
    responseType: 'stream',
  }).then(response => {
    response.data.pipe(writer);
    return finished(writer); //this is a Promise
  });
}