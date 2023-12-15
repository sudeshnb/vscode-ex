// var fs = require('fs');

// // Consts
// var PLUGIN_NAME = 'reference-parser';

// // Plugin level function (dealing with files)
// function referenceParser(fileName, prefix, filterParentReferences) {
//     var references = [];

//     var content = fs.readFileSync(fileName, 'utf8');
//     content = content.replace(/\/\/\/ ,?/g, '.js');

//     function readLines(input) {
//         if (input.length === 0)
//             return;

//         var newLineIndex = input.indexOf('\r\n');
//         if (newLineIndex >= 0) {
//             var line = input.substring(0, newLineIndex).trim();

//             readLine(line);

//             if (input.length > (newLineIndex + 2))
//                 readLines(input.substring(newLineIndex + 2));
//         } else {
//             readLine(input);
//         }
//     }

//     function readLine(line) {
//         if (line && line.length > 0) {
//             //console.log('Line: ' + line);

//             if (line.startsWith('//')) {
//                 //console.log('Comment line, ignored.');
//             } else if (line.indexOf('_references.ts') >= 0) {
//                 //console.log('External reference line, ignored.'); // TODO Support this?
//             } else if (filterParentReferences && line.startsWith('../')) {
//                 //console.log('Parent reference, ignored.');
//             } else {
//                 references.push(line);
//             }
//         }
//     }

//     readLines(content);
//     return references;
// }

// // Exporting the plugin main function
// module.exports = referenceParser;
