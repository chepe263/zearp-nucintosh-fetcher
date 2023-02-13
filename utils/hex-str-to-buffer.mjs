import _ from 'lodash';
/**
 * With a string, divide in pair and treat each pair as a hex number
 * then convert each hex number into integer and put all those numbers
 * inside an array. Then pretend the result is a buffer.
 * This is specially for plist "data" type, since plist library makes a buffer
 * @param {String} hex_str - the hex like string 
 * @returns {Array<Number>} - An array with each hex pair as a number (Integer, probably)
 */
export default function(hex_str){
    hex_str = hex_str.trim().replace(/\s+/g,'')
    let pairs = hex_str.match(/(..?)/g)
    let new_data = _.map(pairs, o => {
        return Number(`0x${o}`)
    })
    // console.log(pairs, new_data)
    return new_data;

}