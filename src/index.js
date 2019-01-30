const {
  BaseKonnector,
  requestFactory,
  signin,
  scrape,
  saveBills,
  log
} = require('cozy-konnector-libs')
const request = requestFactory({
  // the debug mode shows all the details about http request and responses. Very useful for
  // debugging but very verbose. That is why it is commented out by default
  // debug: true,
  // activates [cheerio](https://cheerio.js.org/) parsing on each page
  cheerio: true,
  // If cheerio is activated do not forget to deactivate json parsing (which is activated by
  // default in cozy-konnector-libs
  json: false,
  // this allows request-promise to keep cookies between requests
  jar: true
})

const baseUrl = 'https://www.spartoo.com'

module.exports = new BaseKonnector(start)

async function start(fields) {
  log('info', 'Authenticating ...')
  await authenticate(fields.login, fields.password)
  log('info', 'Successfully logged in')
  // The BaseKonnector instance expects a Promise as return of the function
  /* log('info', 'Fetching the list of documents')
   const $ = await request(`${baseUrl}/index.html`)
   // cheerio (https://cheerio.js.org/) uses the same api as jQuery (http://jquery.com/)
   log('info', 'Parsing list of documents')
   const documents = await parseDocuments($)
 
   // here we use the saveBills function even if what we fetch are not bills, but this is the most
   // common case in connectors
   log('info', 'Saving data to Cozy')
   await saveBills(documents, fields, {
     // this is a bank identifier which will be used to link bills to bank operations. These
     // identifiers should be at least a word found in the title of a bank operation related to this
     // bill. It is not case sensitive.
     identifiers: ['books']
   })*/
}

function authenticate(username, password) {
  return signin({
    url: `https://www.spartoo.com/securelogin.php?from=compte`,
    formSelector: '.loginContent form',
    formData: { email_address: username, password },
    validate: (statusCode, $, fullResponse) => {
      if ($(`a.deconnect`).length === 1 && fullResponse.request.uri.href == 'https://www.spartoo.com/compte.php') {
        return true
      } else {
        log('error', $('.messageStackError').text())
        return false
      }
    }
  })
}

// The goal of this function is to parse a html page wrapped by a cheerio instance
// and return an array of js objects which will be saved to the cozy by saveBills (https://github.com/konnectors/libs/blob/master/packages/cozy-konnector-libs/docs/api.md#savebills)
function parseDocuments($) {
  // you can find documentation about the scrape function here :
  // https://github.com/konnectors/libs/blob/master/packages/cozy-konnector-libs/docs/api.md#scrape
  const docs = scrape(
    $,
    {
      title: {
        sel: 'h3 a',
        attr: 'title'
      },
      amount: {
        sel: '.price_color',
        parse: normalizePrice
      },
      fileurl: {
        sel: 'img',
        attr: 'src',
        parse: src => `${baseUrl}/${src}`
      },
      filename: {
        sel: 'h3 a',
        attr: 'title',
        parse: title => `${title}.jpg`
      }
    },
    'article'
  )
  return docs.map(doc => ({
    ...doc,
    // the saveBills function needs a date field
    // even if it is a little artificial here (these are not real bills)
    date: new Date(),
    currency: '€',
    vendor: 'template',
    metadata: {
      // it can be interesting that we add the date of import. This is not mandatory but may be
      // useful for debugging or data migration
      importDate: new Date(),
      // document version, useful for migration after change of document structure
      version: 1
    }
  }))
}

// convert a price string to a float
function normalizePrice(price) {
  return parseFloat(price.replace('£', '').trim())
}
