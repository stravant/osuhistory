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
var PlayerCount = 0;

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

var EnableRow;


var TopBarHeight = 30;


function Player(userId) {
	this.userId = userId;
	this.mostRecentUsername = null;
	this.allUsernames = {};
	this.usernamesInOrder = [];
	this.highestRank = TotalRanks;
	this.ranks = [];
	this.pp = [];
	this.hovered = false;
	this.selected = false;
	this.shown = true;
	this.color = [0, 0, 0];
}

function getPlayer(userId) {
	var player = PlayerData[userId];
	if (player == undefined) {
		player = new Player(userId);
		PlayerData[userId] = player;
		++PlayerCount;
	}
	return player;
}

function getPlayerByUsername(username) {
	for (var userId in PlayerData) {
		var player = PlayerData[userId];
		if (player.allUsernames[username]) {
			player.shown = true;
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
			if (player.usernamesInOrder.length == 0 || player.usernamesInOrder[player.usernamesInOrder.length - 1] != playerData.username) {
				player.usernamesInOrder.push(playerData.username);
			}
		})
	});

	for (var userId in PlayerData) {
		// Show only good players by default
		var player = PlayerData[userId];
		if (player.highestRank > 4) {
			player.shown = false;
		}

		// Calculate the full name of the player
		var fullName = player.usernamesInOrder[player.usernamesInOrder.length - 1];
		var arr = player.usernamesInOrder.slice(0, -1).reverse();
		if (arr.length > 0) {
			fullName = fullName + " (" + arr.join(", ") + ")";
		}
		player.fullName = fullName;
	}	

	var queryParam = /#(.*)$/.exec(window.location.href)[1];
	if (queryParam) {
		var user = getPlayerByUsername(queryParam.toLowerCase());
		if (user) {
			user.selected = true;
			CurrentSelectedPlayer = user;
		}
	}

	getPlayerByUsername('azer').shown = true;

	// For each player assign a color
	/*var n;
	for (var userId in PlayerData) {
		var player = PlayerData[userId];
		player.color = 
	}
	hslToRgb*/

}

function setHoverPlayer(player) {
	if (CurrentHoverPlayer != null) {
		CurrentHoverPlayer.hovered = false;
	}

	CurrentHoverPlayer = player;

	if (CurrentHoverPlayer != null) {
		CurrentHoverPlayer.hovered = true;
		NameDiv.innerHTML = CurrentHoverPlayer.fullName;
	} else {
		NameDiv.innerHTML = "";
	}
}

function setSelectedPlayer(player) {
	if (CurrentSelectedPlayer != null) {
		CurrentSelectedPlayer.selected = false;
	}

	CurrentSelectedPlayer = player;

	if (CurrentSelectedPlayer != null) {
		CurrentSelectedPlayer.selected = true;
	}
}

function rankCoord(i, rank) {
	return [
		Math.floor(Canvas.width * SampleFraction[i]),
		Math.floor((Canvas.height / TotalRanks) * rank) + TopBarHeight
	];
}

function drawPlayerPath(ctx, player) {
	ctx.beginPath();
	var lastDrawnName = -0.2;
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
	var stroke = ctx.strokeStyle;
	ctx.stroke();
	if (!(player.color[0] == 0 && player.color[1] == 0 && player.color[2] == 0) || player.hovered || player.selected) {
		for (var i = 1; i < player.ranks.length; ++i) {
			var lastRank = player.ranks[i - 1];
			var thisRank = player.ranks[i];
			if (thisRank != undefined) {
				var coord = rankCoord(i, thisRank);
				var sample = SampleFraction[i];
				if (sample - lastDrawnName > 0.2 && (lastRank == thisRank)) {
					lastDrawnName = sample;
					ctx.save();
					ctx.font = '8pt sans-serif';
					ctx.lineWidth = 3;
					ctx.textAlign = 'center';
					ctx.strokeStyle = 'white';
					ctx.strokeText(player.mostRecentUsername, coord[0], coord[1] - 1);
					ctx.fillStyle = stroke;
					ctx.fillText(player.mostRecentUsername, coord[0], coord[1] - 1);
					ctx.restore();
				}
			}
		}
	}
}

function drawPlayer(ctx, player) {
	if (!player.shown) {
		return;
	}

	// For hover player, outline in white
	var lineWidth;
	if (player.hovered || player.selected) {
		if (player.hovered) {
			lineWidth = 4;
		} else {
			lineWidth = 6;
		}
	} else {
		if (player.color[0] == 0 && player.color[1] == 0 && player.color[2] == 0) {
			lineWidth = 1;
		} else {
			lineWidth = 2;
		}
	}
	
	if (player.hovered || player.selected) {
		ctx.lineWidth = lineWidth + 4;
		ctx.strokeStyle = 'white';
		drawPlayerPath(ctx, player);
	}

	// Line setup
	ctx.save();
	ctx.lineWidth = lineWidth; 
	if (player.hovered || player.selected) {
		if (player.color[0] == 0 && player.color[1] == 0 && player.color[2] == 0) {
			if (player.selected) {
				ctx.strokeStyle = 'red';
			} else {
				ctx.strokeStyle = 'rgb(200, 0, 0)';
			}
		} else {
			ctx.strokeStyle = 'rgb(' + player.color[0] + ',' + player.color[1] + ',' + player.color[2] + ')';
		}
		if (player.selected) {
			ctx.setLineDash([8, 2]);/*dashes are 5px and spaces are 3px*/
		}
	} else {
		if (player.color[0] == 0 && player.color[1] == 0 && player.color[2] == 0) {
			ctx.strokeStyle = 'rgb(60, 60, 60)';
		} else {
			ctx.strokeStyle = 'rgb(' + player.color[0] + ',' + player.color[1] + ',' + player.color[2] + ')';
		}
	}

	// Draw
	drawPlayerPath(ctx, player);

	ctx.restore();

}

function drawYears(ctx) {
	var startDate = getDate(OsuHistory[0])
	var endDate = getDate(OsuHistory[OsuHistory.length-1]);
	for (var year = 2012; year <= 2017; ++year) {
		var frac = (new Date(year, 1, 1) - startDate) / (endDate - startDate);
		var x = frac*Canvas.width
		ctx.lineWidth = 7;
		ctx.strokeStyle = 'rgb(200, 200, 200)';
		ctx.beginPath();
		ctx.moveTo(x, TopBarHeight - 13);
		ctx.lineTo(x, Canvas.height);
		ctx.stroke();
		ctx.font = '20px serif';
		ctx.textAlign = 'center';
		ctx.fillText("" + year, x, TopBarHeight - 14);
	}
}

function drawGraph() {
	var ctx = Canvas.getContext('2d');

	ctx.clearRect(0, 0, Canvas.width, Canvas.height);

	ctx.save();
	ctx.translate(-0.5, 0.5);

	drawYears(ctx);

	for (var userId in PlayerData) {
		var player = PlayerData[userId];
		if (!player.hovered && !player.selected) {
			drawPlayer(ctx, player);
		}
	}

	if (CurrentSelectedPlayer != null && CurrentSelectedPlayer != CurrentHoverPlayer) {
		drawPlayer(ctx, CurrentSelectedPlayer);
	}

	if (CurrentHoverPlayer != null) {
		drawPlayer(ctx, CurrentHoverPlayer);
	}


	ctx.restore();
}

function resizeGraph() {
	var container = document.getElementById('graph');
	Canvas.width = container.offsetWidth;
	Canvas.height = Math.floor(container.offsetWidth * 0.7);
}

function getClosestPlayer(x, y) {
	y = y - TopBarHeight
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

function updateGraph_Click(x, y) {
	var target = getClosestPlayer(x, y);
	if (target != CurrentSelectedPlayer) {
		setSelectedPlayer(target);
		drawGraph();
	}
}

function updateGraph_Leave() {
	if (CurrentHoverPlayer != null) {
		setHoverPlayer(null);
		drawGraph();
	}
}

function createEnableRow(player) {
	var tb = document.getElementById('un-table');
	var newNode = EnableRow.cloneNode(true);
	tb.appendChild(newNode);


	var checkBox = newNode.getElementsByClassName('un-check')[0];
	checkBox.checked = player.shown;

	newNode.getElementsByClassName('un-name')[0].innerHTML = player.fullName;
	newNode.addEventListener('mouseenter', function() {
		setHoverPlayer(player);
		drawGraph();
	});
	newNode.addEventListener('mouseleave', function() {
		setHoverPlayer(null);
		drawGraph();
	});
	newNode.addEventListener('mouseclick', function() {
		console.log(checkBox);
		checkBox.checked = !checkBox.checked;
	});
	
}

function createEnableRows() {
	
	var sortedPlayers = []
	for (var userId in PlayerData) {
		var player = PlayerData[userId];
		sortedPlayers.push(player);
	}
	sortedPlayers.sort(function(a, b) {
		return a.highestRank - b.highestRank;
	});
	sortedPlayers.forEach(createEnableRow);
}


document.addEventListener('DOMContentLoaded', function() {
	Canvas = document.getElementById('graph');

	NameDiv = document.getElementById('player-name');

	EnableRow = document.getElementById('un-row');
	EnableRow.remove();
	
	// Load in the data
	loadData();

	// Create enables
	createEnableRows();

	getPlayerByUsername('cookiezi').color = [180, 0, 0];
	getPlayerByUsername('wubwoofwolf').color = [0, 180, 0];
	getPlayerByUsername('thelewa').color = [0, 0, 180];
	getPlayerByUsername('hvick225').color = [0, 180, 180];
	getPlayerByUsername('rrtyui').color = [180, 0, 180];
	getPlayerByUsername('sayonara-bye').color = [180, 180, 0];
	getPlayerByUsername('rafis').color = [140, 140, 170];

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
	Canvas.addEventListener('click', function(e) {
		updateGraph_Click(e.offsetX, e.offsetY);
	});
	window.addEventListener('resize', function() {
		resizeGraph();
		drawGraph();
	});
});