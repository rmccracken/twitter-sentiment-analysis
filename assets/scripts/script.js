let popularTweetData = $('#popular-tweets').text();
let database = firebase.database();

function updateSearchesDatabase(searchTerm) {

	database.ref('recentSearches').once('value', (snapshot) => {
		if (snapshot.exists()) {
		//Convert JSON to array
		let searchArray = Object.values(snapshot.val());
		//Check if search term exists anywhere in children
		let searchExists = false;	
		for (var key in searchArray) {
			if (searchArray[key].searchTerm === searchTerm) {
				searchExists = true;
			}
		}

		if (!searchExists) {
			//Remove results at beginning until there are only 4
			while(searchArray.length > 4) {
				searchArray.shift();
			}
			
			//Stringify array, parse string, set database
			database.ref('recentSearches').set(JSON.parse(JSON.stringify(searchArray)));	

			//Push new search term to database
			database.ref('recentSearches').push({searchTerm});
		}
		
		}
	});	
}

function displayRecentSearches(snapshot) {
	let searches = snapshot.val();
	$('#recent-searches').empty();
	for (var key in searches) {
		if (searches.hasOwnProperty(key)) {
			let newButton = $('<span>', {
				'data-query': searches[key].searchTerm,
				'class': 'recent-search-link',
				text: decodeURIComponent(searches[key].searchTerm),
				click: (event) => {
					this.doTwitterSearch($(event.target).data('query'));
				}
			});

			$('#recent-searches').append(newButton);				
		}
	}
}

function doWOEIDRequest(locationSearch) {
	$.ajax({
		method: 'GET',
		url: `https://query.yahooapis.com/v1/public/yql?q=select%20woeid%20from%20geo.places(1)%20where%20text%3D%22${locationSearch}%22&format=json&env=store%3A%2F%2Fdatatables.org%2Falltableswithkeys`
	}).done((response) => {
		if (response.query.results !== null) {
			this.getTrendingTopics(response.query.results.place.woeid);
		}
	});
}

function getTrendingTopics(woeid) {
	$.ajax({
		method: 'GET',
		url: `https://twitter-trending-analysis.herokuapp.com/trending/?id=${woeid}`,
	}).done( (response) => {
		displayTrendingTopics(JSON.parse(response));	
	});
}

function displayTrendingTopics(response) {
	response = response[0].trends;

	let targetDiv = $('#trending-topics');
	targetDiv.empty();
	for (let i = 0; i < response.length; i++) {
		let newButton = $('<button>', {
			'class': 'btn btn-secondary',
			'data-query': response[i].query,
			text: response[i].name,
			click: (event) => {
				this.doTwitterSearch( $(event.target).text());
			}
		});

		targetDiv.append(newButton);
	}
}

function doTwitterSearch(searchTerm) {
	this.updateSearchesDatabase(searchTerm);
	this.doTwitterRequest(searchTerm, 'popular');
	this.doTwitterRequest(searchTerm, 'recent');
}

function doTwitterRequest(searchTerm, searchType) {
	$.ajax({
		method: 'GET',
		url: `https://twitter-trending-analysis.herokuapp.com/tweets/?q=${searchTerm}&t=${searchType}`,
	}).done( (response) => {
		let targetHTML = searchType === 'popular' ? document.getElementById('popular-tweets') : document.getElementById('recent-tweets');
		processTweetResults(JSON.parse(response),targetHTML);
	});
}

function processTweetResults(response,targetHTML) {
	this.searchResults = [];
	let displayTweets = 0;
	let displayedTweetIds = [];
	
	//Empty any old tweets
	$(targetHTML).empty();

	for (let i = 0; i < response.statuses.length; i++) {
		//If retweeted, display the retweeted status instead
		if (response.statuses[i].hasOwnProperty('retweeted_status')) {
			//Don't display duplicate retweets
			if (displayedTweetIds.indexOf(response.statuses[i].retweeted_status.id_str) === -1) {
				this.searchResults.push(response.statuses[i].retweeted_status.full_text);
				//Only display up to 25 tweets
				if (displayTweets < 25) {
					displayTweets++;
					displayedTweetIds.push(response.statuses[i].retweeted_status.id_str);
					this.displayTweet(targetHTML,response.statuses[i].retweeted_status.id_str);
				}

			}
		//Display original tweet
		} else {
			this.searchResults.push(response.statuses[i].full_text);
			displayedTweetIds.push(response.statuses[i].id_str);
			//Only display up to 25 tweets			
			if (displayTweets < 25) {
				displayTweets++;
				this.displayTweet(targetHTML,response.statuses[i].id_str);
			}
		}

	}

	$('#popular-div').attr('style', 'visibility: visible');
	$('#recent-div').attr('style', 'visibility: visible');
	this.doSentimentAnalysis(searchResults, $(targetHTML).attr('id'));
}

function displayTweet(targetHTML, tweetId) {
	twttr.widgets.createTweet(tweetId,targetHTML,
		{
		 align: 'left'
		})
	  	.then(function (el) {
			twttr.widgets.load();
	 	});	
}

let parsedNegative = new Array();
let parsedPositive = new Array();
let parsedNeutral = new Array();
           		
let parsedRecentNegative = new Array();
let parsedRecentPositive = new Array();
let parsedRecentNeutral = new Array();
let parsedPopularNegative = new Array();
let parsedPopularPositive = new Array();
let parsedPopularNeutral = new Array();

let totalPopularResults = 0;
let totalRecentResults = 0;
let popularResponsesRecieved = 0;
let recentResponsesRecieved = 0;
let recentPosPercent;
let recentNegPercent;
let recentNeutralPercent;
let popularPosPercent;
let popularNegPercent;
let popularNeutralPercent;
let recentResultsCalculated = false;
let popularResultsCalculated = false;

function doSentimentAnalysis(searchResults, targetHTMLId)
{
	if (targetHTMLId === 'popular-tweets') {
		totalPopularResults = searchResults.length;
	} else {
		totalRecentResults = searchResults.length;
	}
	totalResults = searchResults.length;
	let sentimentObject=[];
	for (let i = 0; i < searchResults.length; i++) {
		let form = new FormData();
		form.append("text", searchResults[i]);
		let settings = {
		  "async": true,
		  "crossDomain": true,
		  "url": "https://text-sentiment.p.mashape.com/analyze",
		  "method": "POST",
		  "headers": {
		    "x-mashape-key": "JahSDCynJfmsh9D7aDmHnI63qsDYp1047atjsnvuyr2AKu7PPa",
		    "cache-control": "no-cache",
		    "postman-token": "11b32391-b270-ed47-09d3-94474d4f94c4"
		  },
		  "processData": false,
		  "contentType": false,
		  "mimeType": "multipart/form-data",
		  "data": form,
			"searchType": targetHTMLId 
		}

		$.ajax(settings).done(function (response, targetHTMLId) {
		    let sentimentObject = (JSON.parse(response));
			//console.log(sentimentObject);
			//console.log(this);
			
			if (this.searchType === 'popular-tweets') {
				popularResponsesRecieved++;

				parsedPopularNegative.push(parseFloat(sentimentObject["neg_percent"]));
				parsedPopularPositive.push(parseFloat(sentimentObject["pos_percent"]));
				parsedPopularNeutral.push(parseFloat(sentimentObject["mid_percent"]));
				//console.log('Popular', popularResponsesRecieved, totalPopularResults);

				if (popularResponsesRecieved >= totalPopularResults) {
					//alert('All popular responses recieved');
					
					popularPosPercent = parsedPopularPositive.reduce((pv, cv) => pv+cv, 0) / popularResponsesRecieved;
					popularNegPercent = parsedPopularNegative.reduce((pv, cv) => pv+cv, 0) / popularResponsesRecieved;
					popularNeutralPercent = parsedPopularNeutral.reduce((pv, cv) => pv+cv, 0) / popularResponsesRecieved;	
					$('#overall-sentiment').append(`
						<div>
							<p>Popular Sentiment</p>
							<span>Positive: ${popularPosPercent}</span>
							<span>Negative: ${popularNegPercent}</span>
							<span>Neutral: ${popularNeutralPercent}</span>
						</div>
					`);
					$('#sentiment-div').attr('style', 'visibility: visible');
					popularResultsCalculated = true;
				}
			} else {
				recentResponsesRecieved++;

				parsedRecentNegative.push(parseFloat(sentimentObject["neg_percent"]));
				parsedRecentPositive.push(parseFloat(sentimentObject["pos_percent"]));
				parsedRecentNeutral.push(parseFloat(sentimentObject["mid_percent"]));	

				//console.log('Recent', recentResponsesRecieved, totalRecentResults);				
				if (recentResponsesRecieved >= totalRecentResults) {
					//alert('All recent responeses recieved');
					
					recentPosPercent = parsedRecentPositive.reduce((pv, cv) => pv+cv, 0) / recentResponsesRecieved;
					recentNegPercent = parsedRecentNegative.reduce((pv, cv) => pv+cv, 0) / recentResponsesRecieved;
					recentNeutralPercent = parsedRecentNeutral.reduce((pv, cv) => pv+cv, 0) / recentResponsesRecieved;	
					$('#overall-sentiment').append(`
						<div>
							<p>Recent Sentiment</p>
							<span>Positive: ${recentPosPercent}</span>
							<span>Negative: ${recentNegPercent}</span>
							<span>Neutral: ${recentNeutralPercent}</span>
						</div>
					`);
					$('#sentiment-div').attr('style', 'visibility: visible');
					recentResultsCalculated = true;
				}
			}

			if (popularResultsCalculated && recentResultsCalculated) {
			
			}

			parsedNegative.push(parseFloat(sentimentObject["neg_percent"]));
			parsedPositive.push(parseFloat(sentimentObject["pos_percent"]));
			parsedNeutral.push(parseFloat(sentimentObject["mid_percent"]));
			
			sumPositive = parsedPositive.reduce((pv, cv) => pv+cv, 0);
			sumNegative = parsedNegative.reduce((pv, cv) => pv+cv, 0);
			sumNeutral = parsedNeutral.reduce((pv, cv) => pv+cv, 0);				
		});			

	}				
}
		
			             	
	     //        		// make the loop through each 

$(document).ready(() => {
	//Search USA as default for trending topics
	this.getTrendingTopics('23424977');
});

database.ref('recentSearches').on('value', (snapshot) => {
	this.displayRecentSearches(snapshot);	
});

$('#trending-search-submit-btn').on('click', (event) => {
	event.preventDefault();
	let searchTerm = $('#trending-search-input').val();
	searchTerm = searchTerm.trim();
	if (searchTerm.length > 0) {
		//Encode special characters into escape codes and do search
		this.doTwitterSearch(encodeURIComponent(searchTerm));
	}
});

$('#location-search-submit-btn').on('click', (event) => {
	event.preventDefault();
	let location = $('#location-search-input').val();
	this.doWOEIDRequest(encodeURIComponent(location));
});

$('#trending-search-input').on('click', (event) => {
	$(event.target).val('');
});

$('#location-search-input').on('click', (event) => {
	$(event.target).val('');
});
