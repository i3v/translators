{
	"translatorID": "587709d3-80c5-467d-9fc8-ed41c31e20cf",
	"label": "eLibrary.ru",
	"creator": "Avram Lyon",
	"target": "^https?://elibrary\\.ru/",
	"minVersion": "2.1",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsbv",
	"lastUpdated": "2019-06-21 22:52:13"
}

/*
	***** BEGIN LICENSE BLOCK *****

	eLibrary.ru Translator
	Copyright © 2010-2011 Avram Lyon, ajlyon@gmail.com

	This file is part of Zotero.

	Zotero is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as published by
	the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	Zotero is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
	GNU Affero General Public License for more details.

	You should have received a copy of the GNU Affero General Public License
	along with Zotero. If not, see <http://www.gnu.org/licenses/>.

	***** END LICENSE BLOCK *****
*/

function detectWeb(doc, url) {
	if (url.match(/\/item.asp/)) {
		return getDocType(doc);
	}
	else if (url.match(/\/(query_results|contents|org_items|itembox_items)\.asp/)) {
		return "multiple";
	}
}

function doWeb(doc, url) {
	var articles = [];
	if (detectWeb(doc, url) == "multiple") {
		var results = doc.evaluate('//table[@id="restab"]//tr[@bgcolor = "#f5f5f5"]/td[2]', doc, null, XPathResult.ANY_TYPE, null);
		var items = {};
		var result;
		while ((result = results.iterateNext())) {
			var link = doc.evaluate('./a', result, null, XPathResult.ANY_TYPE, null).iterateNext();
			var title = link.textContent;
			var uri = link.href;
			items[uri] = title;
		}
		Zotero.selectItems(items, function (items) {
			if (!items) {
				return true;
			}
			for (var i in items) {
				articles.push(i);
			}
			Zotero.Utilities.processDocuments(articles, scrape);
		});
	}
	else {
		scrape(doc, url);
	}
}

function fixCasing(string) {
	if (string && string == string.toUpperCase()) {
		return ZU.capitalizeTitle(string, true);
	}
	else return string;
}

function getDocType(doc) {
	docType = ZU.xpathText(doc, '//tr/td/text()[contains(., "Тип:")]/following-sibling::*[1]');
	
	switch (docType) {
		case "обзорная статья":
		case "статья в журнале - научная статья":
		case "научная статья":
		case "статья в журнале":
		case "статья в открытом архиве":
			itemType = "journalArticle";
			break;
		case "учебное пособие":
		case "монография":
			itemType = "book";
			break;
		case "публикация в сборнике трудов конференции":
			itemType = "conferencePaper";
			break;
		default:
			Zotero.debug("Unknown type: " + docType + ". Using 'journalArticle'");
			itemType = "journalArticle";
			break;
	}
	return itemType
}

function scrape(doc, url) {
	var datablock = ZU.xpath(doc, '//td[@align="left" and @valign="top"]//tr[2]/td[@align="left" and @valign="top"]');
	var item = new Zotero.Item();
	
	item.url = url;
	
	/* var pdf = false;
	// Now see if we have a free PDF to download
	var pdfImage = doc.evaluate('//a/img[@src="/images/pdf_green.gif"]', doc, null,XPathResult.ANY_TYPE, null).iterateNext();
	if (pdfImage) {
		// A green PDF is a free one. We need to construct the POST request
		var postData = [], postField;
		var postNode = doc.evaluate('//form[@name="results"]/input', doc, null,XPathResult.ANY_TYPE, null);
		while ((postField = postNode.iterateNext()) !== null) {
			postData.push(postField.name + "=" +postField.value);
		}
		postData = postData.join("&");
		Zotero.debug(postData + postNode.iterateNext());
		Zotero.Utilities.HTTP.doPost('http://elibrary.ru/full_text.asp', postData, function(text) {
			var href = text.match(/http:\/\/elibrary.ru\/download\/.*?\.pdf/)[0];
			pdf = {url:href, title:"eLibrary.ru полный текст", mimeType:"application/pdf"};
		});
	}*/

	var m = doc.title.match(/eLIBRARY.RU - (.*)/);
	if (m) {
		item.title = m[1];
	}
	else {
		item.title = doc.title;
	}
	item.title = fixCasing(item.title);
	
	var authors = ZU.xpath(doc, '//table[@width=550]//td[@width=514]/span[@style="white-space: nowrap"]//b');
	if (!authors.length) {
		authors = ZU.xpath(datablock, './div[1]/table[1]//b');
	}
	
	Zotero.debug('authors.length: ' + authors.length);
	Zotero.debug('authors text: ' + ZU.xpathText(authors, '*'));

	for (var i = 0; i < authors.length; i++) {
		
		/* Some names listed as last first_initials (no comma), so we need
		to fix this by placing a comma in-between.
		Also note that the space between last and first is nbsp */
		
		var cleaned = authors[i].textContent;
		var useComma = false;
		if (cleaned.match(/[\s\u00A0]([A-Z\u0400-\u042f]\.?[\s\u00A0]*)+$/)) {
			cleaned = cleaned.replace(/[\u00A0\s]/, ', ');
			useComma = true;
		}
		
		cleaned = ZU.cleanAuthor(cleaned, "author", useComma);
		// If we have only one name, set the author to one-name mode
		if (cleaned.firstName === "") {
			cleaned.fieldMode = true;
		}
		else {
			// We can check for all lower-case and capitalize if necessary
			// All-uppercase is handled by cleanAuthor
			cleaned.firstName = (cleaned.firstName == cleaned.firstName.toLowerCase() || cleaned.firstName == cleaned.firstName.toUpperCase())
				? Zotero.Utilities.capitalizeTitle(cleaned.firstName, true)
				: cleaned.firstName;
			cleaned.lastName = (cleaned.lastName == cleaned.lastName.toLowerCase() || cleaned.lastName == cleaned.lastName.toUpperCase())
				? Zotero.Utilities.capitalizeTitle(cleaned.lastName, true)
				: cleaned.lastName;
		}
		// Skip entries with an @ sign-- email addresses slip in otherwise
		if (!cleaned.lastName.includes("@")) item.creators.push(cleaned);
	}

	var mapping = {
		"Журнал": "publicationTitle",
		"Издательство": "publisher",
		"Дата депонирования": "date",
		"Год издания": "date",
		"Год": "date",
		"Том": "volume",
		"Номер": "issue",
		"ISSN": "ISSN",
		"Число страниц": "pages", // e.g. "83"
		"Страницы": "pages",      // e.g. "10-16"
		"Язык": "language",
		"Место издания": "place"
	};
	
	
	for (var key in mapping) {
		var t = ZU.xpathText(doc, '//tr/td/text()[contains(., "' + key + ':")]/following-sibling::*[1]');
		if (t) {
			item[mapping[key]] = t;
		}
	}
	/*
	// Times cited in Russian Science Citation Index. 
	// Hardly useful for most users, would just clutter "extra" field.
	// Keeping this just-in-case.
	var rsci = ZU.xpathText(doc, '//tr/td/text()[contains(., "Цитирований в РИНЦ")]/following-sibling::*[2]');
	Zotero.debug("Russian Science Citation Index: " + rsci);
	if (rsci) item.extra = "Цитируемость в РИНЦ: " + rsci;
	*/

	var journalBlock = ZU.xpath(datablock, './div/table[tbody/tr/td/font[contains(text(), "ЖУРНАЛ")]]');
	if (!item.publicationTitle) item.publicationTitle = ZU.xpathText(journalBlock, ".//a[1]");
	item.publicationTitle = fixCasing(item.publicationTitle);

	if (!item.ISSN) item.ISSN = ZU.xpathText(journalBlock, ".//tr[2]//font[last()]");

	var tags = ZU.xpath(datablock, './div/table[tbody/tr/td/font[contains(text(), "КЛЮЧЕВЫЕ СЛОВА")]]//tr[2]/td/a');
	for (var j = 0; j < tags.length; j++) {
		item.tags.push(fixCasing(tags[j].textContent));
	}

	var abstractBlock = ZU.xpath(datablock, "./table[6]")[0];
	if (abstractBlock) item.abstractNote = ZU.xpathText(abstractBlock, './tbody/tr[2]/td[2]/p');

	item.itemType = getDocType(doc);
	
		// Language to RFC-4646 code
	switch (item.language) {
		case "русский":
			item.language = "ru";
			break;
		case "английский":
			item.language = "en";
			break;
		default:
			Zotero.debug("Unknown language: " + item.language + " - keeping as-is.");
			break;
	}

	/* if (referenceBlock) {
		var note = Zotero.Utilities.trimInternal(
						doc.evaluate('./tbody/tr/td[2]/table', referenceBlock, null,XPathResult.ANY_TYPE, null)
						.iterateNext().textContent);
		Zotero.debug(note);
		item.notes.push(note);
	}*/
	/*
*/
	var doi = ZU.xpathText(doc, '/html/head/meta[@name="doi"]/@content');
	if (doi) item.DOI = doi;

	// if (pdf) item.attachments.push(pdf);

	item.complete();
}


/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://elibrary.ru/org_items.asp?orgsid=3326",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "https://elibrary.ru/item.asp?id=9541154",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "Иноязычные заимствования в художественной прозе на иврите в XX в",
				"creators": [
					{
						"firstName": "М. В.",
						"lastName": "Свет",
						"creatorType": "author"
					}
				],
				"date": "2007",
				"ISSN": "0320-8095",
				"issue": "1",
				"language": "ru",
				"libraryCatalog": "eLibrary.ru",
				"pages": "40-58",
				"publicationTitle": "Вестник Московского Университета. Серия 13: Востоковедение",
				"url": "https://elibrary.ru/item.asp?id=9541154",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://elibrary.ru/item.asp?id=17339044",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "Использование Молекулярно-Генетических Методов Установления Закономерностей Наследования Для Выявления Доноров Значимых Признаков Яблони",
				"creators": [
					{
						"firstName": "Иван Иванович",
						"lastName": "Супрун",
						"creatorType": "author"
					},
					{
						"firstName": "Елена Владимировна",
						"lastName": "Ульяновская",
						"creatorType": "author"
					},
					{
						"firstName": "Евгений Николаевич",
						"lastName": "Седов",
						"creatorType": "author"
					},
					{
						"firstName": "Галина Алексеевна",
						"lastName": "Седышева",
						"creatorType": "author"
					},
					{
						"firstName": "Зоя Михайловна",
						"lastName": "Серова",
						"creatorType": "author"
					}
				],
				"date": "2012",
				"ISSN": "2219-5335",
				"issue": "13 (1)",
				"language": "ru",
				"libraryCatalog": "eLibrary.ru",
				"pages": "1-10",
				"publicationTitle": "Плодоводство И Виноградарство Юга России",
				"url": "https://elibrary.ru/item.asp?id=17339044",
				"attachments": [],
				"tags": [
					"Apple-Tree",
					"Immunity",
					"Scab",
					"Variety",
					"Иммунитет",
					"Парша",
					"Сорт",
					"Яблоня"
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://elibrary.ru/item.asp?id=21640363",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "На пути к верификации C программ. Часть 3. Перевод из языка C-light в язык C-light-kernel и его формальное обоснование",
				"creators": [
					{
						"firstName": "В. А.",
						"lastName": "Непомнящий",
						"creatorType": "author"
					},
					{
						"firstName": "И. С.",
						"lastName": "Ануреев",
						"creatorType": "author"
					},
					{
						"firstName": "И. Н.",
						"lastName": "Михайлов",
						"creatorType": "author"
					},
					{
						"firstName": "А. В.",
						"lastName": "Промский",
						"creatorType": "author"
					}
				],
				"date": "14.06.2002",
				"issue": "097",
				"language": "ru",
				"libraryCatalog": "eLibrary.ru",
				"pages": "83",
				"url": "https://elibrary.ru/item.asp?id=21640363",
				"attachments": [],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://elibrary.ru/item.asp?id=21665052",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "Информационно-поисковая полнотекстовая система \"Боярские списки XVIII века\"",
				"creators": [
					{
						"firstName": "А. В.",
						"lastName": "Захаров",
						"creatorType": "author"
					}
				],
				"date": "08.04.2005",
				"issue": "0220510249",
				"language": "ru",
				"libraryCatalog": "eLibrary.ru",
				"url": "https://elibrary.ru/item.asp?id=21665052",
				"attachments": [],
				"tags": [
					{
						"tag": "Археография"
					},
					{
						"tag": "Боярские Списки"
					},
					{
						"tag": "Информационная Система"
					},
					{
						"tag": "Источниковедение"
					},
					{
						"tag": "Московские Чины"
					},
					{
						"tag": "Петр I"
					},
					{
						"tag": "Полнотекстовая База Данных"
					},
					{
						"tag": "Разрядный Приказ"
					},
					{
						"tag": "Царедворцы"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://elibrary.ru/item.asp?id=20028198",
		"items": [
			{
				"itemType": "book",
				"title": "Аппарат издания и правила оформления",
				"creators": [
					{
						"firstName": "Людмила Павловна",
						"lastName": "Стычишина",
						"creatorType": "author"
					},
					{
						"firstName": "А. В.",
						"lastName": "Хохлов",
						"creatorType": "author"
					}
				],
				"language": "ru",
				"libraryCatalog": "eLibrary.ru",
				"publisher": "Изд-во Политехнического университета",
				"url": "https://elibrary.ru/item.asp?id=20028198",
				"attachments": [],
				"tags": [
					{
						"tag": "Аппарат Издания"
					},
					{
						"tag": "Издательское Дело"
					},
					{
						"tag": "Культура. Наука. Просвещение"
					},
					{
						"tag": "Оформление Изданий"
					},
					{
						"tag": "Оформление Книги"
					},
					{
						"tag": "Печать"
					},
					{
						"tag": "Подготовка Рукописи И Графических Материалов К Изданию"
					},
					{
						"tag": "Редакционно-Издательский Процесс"
					},
					{
						"tag": "Российская Федерация"
					},
					{
						"tag": "Теория И Практика Издательского Дела"
					},
					{
						"tag": "Техническое Оформление"
					},
					{
						"tag": "Учебное Пособие Для Высшей Школы"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://elibrary.ru/item.asp?id=38164350",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "Графики негладких контактных отображений на группах карно с сублоренцевой структурой",
				"creators": [
					{
						"firstName": "М. Б.",
						"lastName": "Карманова",
						"creatorType": "author"
					}
				],
				"date": "2019",
				"DOI": "10.31857/S0869-56524863275-279",
				"ISSN": "0869-5652",
				"issue": "3",
				"language": "ru",
				"libraryCatalog": "eLibrary.ru",
				"pages": "275-279",
				"publicationTitle": "Доклады Академии Наук",
				"url": "https://elibrary.ru/item.asp?id=38164350",
				"volume": "486",
				"attachments": [],
				"tags": [
					{
						"tag": "Contact Mapping"
					},
					{
						"tag": "Graph-Mapping"
					},
					{
						"tag": "Intrinsic Basis"
					},
					{
						"tag": "Multidimensional Time"
					},
					{
						"tag": "Nilpotent Graded Group"
					},
					{
						"tag": "Sub-Lorentzian Structure"
					},
					{
						"tag": "Surface Area"
					},
					{
						"tag": "Внутренний Базис"
					},
					{
						"tag": "Контактное Отображение"
					},
					{
						"tag": "Многомерное Время"
					},
					{
						"tag": "Нильпотентная Градуированная Группа"
					},
					{
						"tag": "Отображение-График"
					},
					{
						"tag": "Площадь Поверхности"
					},
					{
						"tag": "Сублоренцева Структура"
					}
				],
				"notes": [],
				"seeAlso": []
			}
		]
	}
]
/** END TEST CASES **/
