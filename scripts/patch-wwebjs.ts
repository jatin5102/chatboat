import fs from 'node:fs';
import path from 'node:path';

const utilsPath = path.resolve('node_modules/whatsapp-web.js/src/util/Injected/Utils.js');

if (fs.existsSync(utilsPath)) {
  let content = fs.readFileSync(utilsPath, 'utf8');
  let modified = false;

  // 1. Strip mediaOptions.id and __x_id
  if (!content.includes('delete mediaOptions.id;')) {
    content = content.replace(
      'delete options.sendMediaAsSticker;',
      'delete options.sendMediaAsSticker;\n            delete mediaOptions.id;\n            delete mediaOptions.__x_id;'
    );
    modified = true;
  }

  // 2. Ensure message.id is restored to newMsgKey
  if (!content.includes('delete message.__x_id;')) {
    content = content.replace(
      '...extraOptions,\n        };',
      `...extraOptions,
        };

        // Fix WhatsApp Web memoize getter crash:
        delete message.__x_id;
        message.id = newMsgKey;
        message.from = from;
        message.to = chat.id;`
    );
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(utilsPath, content, 'utf8');
    console.log('✅ Successfully applied WhatsApp Web memoize getter patch to whatsapp-web.js!');
  } else {
    console.log('ℹ️ whatsapp-web.js is already patched.');
  }
} else {
  console.log('⚠️ whatsapp-web.js not found in node_modules.');
}
