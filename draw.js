"use strict";


function getDate(sample) {
	return new Date(sample.year, sample.month, sample.day);
}

// Remove duplicates from OsuHistory
for (var i = 0; i < OsuHistory.length-1; ++i) {
	var s1 = OsuHistory[i];
	var s2 = OsuHistory[i+1];
	var d1 = getDate(s1);
	var d2 = getDate(s2);
	if ((d2 - d1)/(1000*60*60*24) < 10 /*days*/) {
		OsuHistory.splice(i+1, 1);
		--i;
	}
}

// Data for each player
var PlayerData = {};

// Fraction of the way along the timeline a sample is
var SampleFraction = {};

// Current hovered player
var CurrentHoverPlayer = null;

// Current selected player
var CurrentSelectedPlayer = null;

// How many ranks
var TotalRanks = 50;

// The canvas
var Canvas;

var NameDiv;


function Player(userId) {
	this.userId = userId;
	this.mostRecentUsername = null;
	this.allUsernames = {};
	this.highestRank = TotalRanks;
	this.ranks = [];
	this.pp = [];
	this.hovered = false;
	this.selected = false;
	this.shown = true;
}

function getPlayer(userId) {
	var player = PlayerData[userId];
	if (player == undefined) {
		player = new Player(userId);
		PlayerData[userId] = player;
	}
	return player;
}

function getPlayerByUsername(username) {
	for (var userId in PlayerData) {
		var player = PlayerData[userId];
		if (player.allUsernames[username]) {
			return player;
		}
	}
	return null;
}

function loadData() {
	// Time span
	var firstDate = getDate(OsuHistory[0]);
	var lastDate = getDate(OsuHistory[OsuHistory.length-1]);
	var totalTimeSpan = lastDate - firstDate;

	// Process
	OsuHistory.forEach(function(sample, i) {
		// Process sample
		SampleFraction[i] = (getDate(sample) - firstDate) / totalTimeSpan;

		// Process players
		sample.players.forEach(function(playerData, rank) {
			var player = getPlayer(playerData.userId);

			// Rank
			player.ranks[i] = rank
			player.highestRank = Math.min(player.highestRank, rank);

			// PP
			player.pp[i] = playerData.pp;

			// Most recent username
			player.mostRecentUsername = playerData.username;
			player.allUsernames[playerData.username.toLowerCase()] = true;
		})
	});
}

function setHoverPlayer(player) {
	if (CurrentHoverPlayer != null) {
		CurrentHoverPlayer.hovered = false;
	}

	CurrentHoverPlayer = player;

	if (CurrentHoverPlayer != null) {
		CurrentHoverPlayer.hovered = true;
		NameDiv.innerHTML = CurrentHoverPlayer.mostRecentUsername;
	} else {
		NameDiv.innerHTML = "";
	}
}

function rankCoord(i, rank) {
	return [
		Math.floor(Canvas.width * SampleFraction[i]),
		Math.floor((Canvas.height / TotalRanks) * rank)
	];
}

function drawPlayer(ctx, player) {
	if (!player.shown) {
		return;
	}

	ctx.beginPath();
	for (var i = 1; i < player.ranks.length; ++i) {
		var lastRank = player.ranks[i - 1];
		var thisRank = player.ranks[i];
		if (thisRank != undefined) {
			var coord = rankCoord(i, thisRank);
			if (lastRank != undefined) {
				ctx.lineTo(coord[0], coord[1]);
			} else {
				ctx.moveTo(coord[0], coord[1]);
			}
		}
	}
	ctx.lineWidth = 1;
	ctx.lineCap = 'round';
	if (player.hovered) {
		ctx.lineWidth = 3
		ctx.strokeStyle = 'red';
	} else {
		ctx.strokeStyle = 'black';
	}
	ctx.stroke();
	//ctx.closePath();

}

function drawGraph() {
	var ctx = Canvas.getContext('2d');

	ctx.clearRect(0, 0, Canvas.width, Canvas.height);

	ctx.save();
	ctx.translate(-0.5, 0.5);

	for (var userId in PlayerData) {
		var player = PlayerData[userId];
		if (!player.hovered && !player.selected) {
			drawPlayer(ctx, player);
		}
	}

	if (CurrentHoverPlayer != null) {
		drawPlayer(ctx, CurrentHoverPlayer);
	}

	if (CurrentSelectedPlayer != null && CurrentSelectedPlayer != CurrentHoverPlayer) {
		drawPlayer(ctx, CurrentSelectedPlayer);
	}


	ctx.restore();
}

function resizeGraph() {
	var container = document.getElementById('graph');
	Canvas.width = container.offsetWidth;
	Canvas.height = Math.floor(container.offsetWidth * 0.7);
}

function getClosestPlayer(x, y) {
	// Get the index into the samples where the cursor is
	var xFrac = x / Canvas.width;
	//console.log(xFrac);
	var i;
	for (var j = 0; j < OsuHistory.length; ++j) {
		if (SampleFraction[j] > xFrac) {
			i = j - 1;
			break;
		}
	}
	// Get the offset into the sample
	var run = (SampleFraction[i+1] - SampleFraction[i])
	var f = (xFrac - SampleFraction[i]) / run;
	run = run * Canvas.width;
	var yRank = (y / Canvas.height) * TotalRanks;
	var bestPlayer = null;
	var bestDiff = 999999;
	for (var userId in PlayerData) {
		var player = PlayerData[userId];
		if (player.shown) {
			var rank1 = player.ranks[i];
			var rank2 = player.ranks[i+1];
			if (rank1 != undefined && rank2 != undefined) {
				var y = rank2*f + rank1*(1-f);
				var diff = Math.abs(y - yRank);
				var slope = Math.abs(rank2 - rank1) / run;
				diff = diff*Math.sin(Math.atan(1 / slope));
				if (diff < bestDiff) {
					bestDiff = diff;
					bestPlayer = player;
				}
			}
		}
	}
	return bestPlayer;
}

function updateGraph_Hover(x, y) {
	var newHover = getClosestPlayer(x, y);
	if (newHover != CurrentHoverPlayer) {
		setHoverPlayer(newHover);
		drawGraph();
	}
}

function updateGraph_Leave() {
	if (CurrentHoverPlayer != null) {
		setHoverPlayer(null);
		drawGraph();
	}
}


document.addEventListener('DOMContentLoaded', function() {
	console.log("Loading...");

	Canvas = document.getElementById('graph');

	NameDiv = document.getElementById('player-name');
	
	// Load in the data
	loadData();

	//getPlayerByUsername('cookiezi').hovered = true;

	// Draw the graph
	resizeGraph();
	drawGraph();

	// Event handler
	Canvas.addEventListener('mousemove', function(e) {
		updateGraph_Hover(e.offsetX, e.offsetY);
	});
	Canvas.addEventListener('mouseleave', function(e) {
		updateGraph_Leave();
	});
	window.addEventListener('resize', function() {
		resizeGraph();
		drawGraph();
	});

	console.log("Loaded");
});