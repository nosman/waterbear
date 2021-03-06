(function(wb){

	function clearScripts(event, force){
		if (force || confirm('Throw out the current script?')){
			var workspace = document.querySelector('.workspace > .scripts_workspace');
            var path = location.href.split('?')[0];
            history.pushState(null, '', path);
			workspace.parentElement.removeChild(workspace);
			wb.scriptModified = false;
			wb.scriptLoaded = false;
			wb.loaded = false;
			createWorkspace('Workspace');
			document.querySelector('.workspace > .scripts_text_view').innerHTML = '';
			wb.history.clear();
			wb.resetSeqNum();
			delete localStorage['__' + wb.language + '_current_scripts'];
		}
	}
	
	function loadExample(event){
		var path = location.href.split('?')[0];
		path += "?example=" + event.target.dataset.example;
		if (wb.scriptModified){
			if (confirm('Throw out the current script?')){
				wb.scriptModified = false;
				wb.loaded = false;
				history.pushState(null, '', path);
				Event.trigger(document.body, 'wb-state-change');
			}
		}else{
			wb.scriptModified = false;
			wb.loaded = false;
			history.pushState(null, '', path);
			Event.trigger(document.body, 'wb-state-change');
		}
	}

	function handleStateChange(event){
		// hide loading spinner if needed
		console.log('handleStateChange');
		hideLoader();
		wb.queryParams = wb.urlToQueryParams(location.href);
		if (wb.queryParams.view === 'result'){
			document.body.className = 'result';
			wb.view = 'result';
		}else{
			document.body.className = 'editor';
			wb.view = 'editor';
		}
		// handle loading example, gist, currentScript, etc. if needed
	    wb.loadCurrentScripts(wb.queryParams);
	    // If we go to the result and can run the result inline, do it
	    if (wb.view === 'result' && wb.runCurrentScripts){
	    	// console.log('running current scripts');
	    	wb.runCurrentScripts();
	    }else{
	    	if (wb.view === 'result'){
		    	// console.log('we want to run current scripts, but cannot');
		    }else{
		    	// console.log('we do not care about current scripts, so there');
		    }
	    }
	}

	function hideLoader(){
	    var loader = document.querySelector('#block_menu_load');
	    if (loader){
	        loader.parentElement.removeChild(loader);
	    }		
	}

	function historySwitchState(state, clearFiles){
		//console.log('historySwitchState(%o, %s)', state, !!clearFiles);
		var params = wb.urlToQueryParams(location.href);
		if (state !== 'result'){
			delete params['view'];
		}else{
			params.view = state;
		}
		if (clearFiles){
			delete params['gist'];
			delete params['example'];
		}
		history.pushState(null, '', wb.queryParamsToUrl(params));
		Event.trigger(document.body, 'wb-state-change');
	}

	window.addEventListener('unload', wb.saveCurrentScripts, false);
	window.addEventListener('load', wb.loadRecentGists, false);

	// Allow saved scripts to be dropped in
	function createWorkspace(name){
	    // console.log('createWorkspace');
		var id = uuid();
		var workspace = wb.Block({
			group: 'scripts_workspace',
			id: id,
			scriptId: id,
			scopeId: id,
			blocktype: 'context',
			sockets: [
			{
				name: name
			}
			],
			script: '[[1]]',
			isTemplateBlock: false,
			help: 'Drag your script blocks here'
		});
		wb.wireUpWorkspace(workspace);
	}
	
	function wireUpWorkspace(workspace){
		workspace.addEventListener('drop', wb.getFiles, false);
		workspace.addEventListener('dragover', function(event){event.preventDefault();}, false);
		wb.findAll(document, '.scripts_workspace').forEach(function(ws){
	        ws.parentElement.removeChild(ws); // remove any pre-existing workspaces
	    });
		document.querySelector('.workspace').appendChild(workspace);
		workspace.querySelector('.contained').appendChild(wb.elem('div', {'class': 'dropCursor'}));
		wb.initializeDragHandlers();
	};

	function handleDragover(event){
	    // Stop Firefox from grabbing the file prematurely
	    event.stopPropagation();
	    event.preventDefault();
	    event.dataTransfer.dropEffect = 'copy';
	}

	function disclosure(event){
		var block = wb.closest(event.wbTarget, '.block');
		if (block.dataset.closed){
			delete block.dataset.closed;
		}else{
			block.dataset.closed = true;
		}
	}

	function handleScriptLoad(event){
		wb.scriptModified = false;
		wb.scriptLoaded = true;
		if (wb.view === 'result'){
			// console.log('run script because we are awesome');
			if (wb.windowLoaded){
				// console.log('run scripts directly');
				wb.runCurrentScripts();
			}else{
				// console.log('run scripts when the iframe is ready');
				window.addEventListener('load', function(){
				// 	// console.log('in window load, starting script: %s', !!wb.runCurrentScripts);
				 	wb.runCurrentScripts();
				 }, false);
			}
		// }else{
		// 	console.log('do not run script for some odd reason: %s', wb.view);
		}
		// clear undo/redo stack
		console.log('script loaded');
	}

	function handleScriptModify(event){
		// still need modified events for changing input values
		if (!wb.scriptLoaded) return;
		if (!wb.scriptModified){
			wb.scriptModified = true;
			wb.historySwitchState(wb.view, true);
		}
	}

	window.addEventListener('popstate', function(event){
		// console.log('popstate event');
		Event.trigger(document.body, 'wb-state-change');
	}, false);

	// Kick off some initialization work
	window.addEventListener('load', function(){
		console.log('window loaded');
		wb.windowLoaded = true;
		Event.trigger(document.body, 'wb-state-change');
	}, false);

	Event.on('.clear_scripts', 'click', null, clearScripts);
	Event.on('.edit-script', 'click', null, function(event){
		wb.historySwitchState('editor');
	});
	Event.on('.content', 'click', '.load-example', loadExample);
	Event.on(document.body, 'wb-state-change', null, handleStateChange);
	Event.on('.save_scripts', 'click', null, wb.saveCurrentScriptsToGist);
	Event.on('.download_scripts', 'click', null, wb.createDownloadUrl);
	Event.on('.load_from_gist', 'click', null, wb.loadScriptsFromGistId);
	Event.on('.restore_scripts', 'click', null, wb.loadScriptsFromFilesystem);
	Event.on('.workspace', 'click', '.disclosure', disclosure);
	Event.on('.workspace', 'dblclick', '.locals .name', wb.changeName);
	Event.on('.workspace', 'keypress', 'input', wb.resize);
	Event.on('.workspace', 'change', 'input, select', function(event){
		Event.trigger(document.body, 'wb-modified', {block: event.wbTarget, type: 'valueChanged'});
	});
	Event.on(document.body, 'wb-script-loaded', null, handleScriptLoad);
	Event.on(document.body, 'wb-modified', null, handleScriptModify);

	wb.language = location.pathname.match(/\/([^/.]*)\.html/)[1];
	wb.loaded = false;
	wb.clearScripts = clearScripts;
	wb.historySwitchState = historySwitchState;
	wb.createWorkspace = createWorkspace;
	wb.wireUpWorkspace = wireUpWorkspace;
})(wb);
