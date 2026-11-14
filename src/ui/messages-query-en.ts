// SPDX-License-Identifier: Apache-2.0
// The texts of the Query, Vocabulary and Page data tabs of the explorer page, and of the cards that
// mention the model's graph tool. Part of the English dictionary (messages-en.ts spreads it).

export const QUERY_EN = {
  explorerTabQuery: 'Query',
  explorerTabVocab: 'Vocabulary',
  explorerTabPageData: 'Page data',
  queryHeading: 'Ask this node’s graph',
  queryIntro:
    'Write a read-only SPARQL query (SELECT or ASK). It runs in your browser on the graph this node published. Nothing is sent anywhere, and nothing is changed.',
  queryEditorLabel: 'SPARQL query',
  queryRun: 'Run',
  queryStop: 'Stop',
  queryReady: 'Press Run to ask.',
  queryLoading: 'Reading the graph…',
  queryRunning: 'Running…',
  queryAnswered: '{form} answered with {count} rows.',
  queryAnsweredAsk: 'ASK answered {answer}.',
  queryStopped: 'Stopped.',
  queryTimedOut:
    'The query took longer than {seconds} seconds and was stopped. Add LIMIT or ask for less.',
  queryCaption: 'The result: {count} rows, the first {shown} shown here.',
  queryCaptionAll: 'The result: {count} rows.',
  queryExamplesHeading: 'Example questions',
  queryExamplesNote:
    'A question that names X, or a list of names, is a pattern: replace the placeholder with the names of items before you run it.',
  queryPut: 'Put in editor',
  queryPutLabel: 'Put in editor: {question}',
  queryNeedsEdit: 'Replace the placeholder first.',
  vocabHeading: 'Vocabulary of this node',
  vocabIntro:
    'The classes and properties this node says it uses, read from the vocabulary file it published.',
  vocabLoading: 'Reading the vocabulary…',
  vocabClasses: 'Classes',
  vocabProperties: 'Properties',
  vocabFiles: 'Vocabulary files of this node',
  vocabOpen: 'Open',
  vocabOpenLabel: 'Open {name} in a new tab',
  vocabColumnIri: 'Name',
  vocabColumnLabel: 'Label',
  vocabColumnComment: 'Comment',
  vocabColumnDomain: 'Applies to',
  vocabColumnRange: 'Value',
  vocabNoFiles: 'The node names no vocabulary file on its own address.',
  pageDataHeading: 'Data of the open page',
  pageDataIntro:
    'The structured data (JSON-LD) that the page in the tab says about itself, shown as text. WebAIAssist has not checked it.',
  pageDataLoading: 'Reading the page…',
  pageDataNone: 'The page has no JSON-LD, or it could not be read.',
  pageDataCut: 'Cut after {count} characters.',
  toolReserved: 'name reserved by WebAIAssist: built-in, not offered to the model',
} as const;
