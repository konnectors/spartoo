const {
  BaseKonnector,
  requestFactory,
  signin,
  scrape,
  saveBills,
  htmlToPDF,
  createCozyPDFDocument,
  log
} = require('cozy-konnector-libs')
const request = requestFactory({
  cheerio: true,
  json: false,
  jar: true
})

const baseUrl = 'https://www.spartoo.com'

module.exports = new BaseKonnector(start)

async function start(fields) {
  log('info', 'Authenticating ...')
  await authenticate(fields.login, fields.password)
  log('info', 'Successfully logged in')
  // The BaseKonnector instance expects a Promise as return of the function
  log('info', 'Fetching the list of documents')
  const $ = await request(`${baseUrl}/ajax/compte/compte_historique.php?type=article`)
  log('info', 'Parsing list of documents')
  const documents = await parseDocuments($)

  log('info', 'Saving data to Cozy')
  await saveBills(documents, fields, {
    identifiers: ['spartoo'],
    contentType: 'application/pdf'
  })
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

async function parseDocuments($) {
  const docs = scrape(
    $,
    {
      amount: {
        sel: 'td:nth-child(5)',
        parse: parseAmount
      },
      fileurl: {
        sel: 'a',
        attr: 'onclick',
        parse: parseUrl
      },
      vendorRef: {
        sel: 'a',
        parse: vendorRef => vendorRef.replace(' ', '').replace(' ', '').replace(' ', '').split(' ')[0]
      },
      date: {
        sel: 'td:nth-child(2)',
        parse: parseDate
      }
    },
    'tbody tr:not(.headingTable)'
  )

   for (var i = 0; i < docs.length; i++) {
    var doc = docs[i]

    // Format date for filename
    doc.formatedDate = formatDate(doc.date)

    // Add required fields for saveBills
    docs[i] = {
      ...doc,
      currency: '€',
      vendor: 'spartoo',
      filename: `${doc.formatedDate}_spartoo_${doc.amount.toFixed(2)}€_${
        doc.vendorRef
        }.pdf`,
      metadata: {
        importDate: new Date(),
        version: 1
      }
    }
    delete docs[i].formatedDate  // remove useless fields for saveBills
  }
  return docs
}

function parseUrl(url) {
  var orderId = url.split('&')[1]
  orderId = orderId.split("'")[0]
  return `${baseUrl}/facturesclient.php?${orderId}`
}

function parseAmount(amount) {
  amount = amount.replace('€', '')
  amount = amount.replace(',', '.')
  return parseFloat(amount)
}

// Convert a french date to Date object
function parseDate(text) {
  const [d, m, y] = text.split('/', 3).map(e => parseInt(e, 10))
  return new Date(y, m - 1, d)
}

// Convert a Date object to a ISO date string
function formatDate(date) {
  let year = date.getFullYear()
  let month = date.getMonth() + 1
  let day = date.getDate()
  if (month < 10) {
    month = '0' + month
  }
  if (day < 10) {
    day = '0' + day
  }
  return `${year}-${month}-${day}`
}
