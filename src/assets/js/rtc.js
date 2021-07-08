
import h from './helpers.js';

window.addEventListener( 'load', () => {
    console.log('1')

    //let callstate = false;
    

    const room = h.getQString( location.href, 'room' );
    const username = sessionStorage.getItem( 'username' );
    
    //when creating room for the first time
    if ( !room ) {
        console.log('2')
        document.querySelector( '#room-create' ).attributes.removeNamedItem( 'hidden' );
    }
    
    else if ( !username ) {
        console.log('3')
        document.querySelector( '#username-set' ).attributes.removeNamedItem( 'hidden' );
    }

    else {
        console.log('4')
        let commElem = document.getElementsByClassName( 'room-comm' );

        for ( let i = 0; i < commElem.length; i++ ) {
            commElem[i].attributes.removeNamedItem( 'hidden' );
        }

        var pc = [];

        let socket = io( '/stream' );

        var socketId = '';
        var myStream = '';
        var screen = '';
        var recordedStream = [];
        var mediaRecorder = '';

        
        //Get user video by default
        console.log('5');
        getAndSetUserStream();
        
        
        //Once the server is up
        socket.on( 'connect', () => {

            console.log('6')
            //set socketId
            socketId = socket.io.engine.id;


            socket.emit( 'subscribe', {
                room: room,
                socketId: socketId
            } );

            console.log('7')


            socket.on( 'new user', ( data ) => {
                
                socket.emit( 'newUserStart', { to: data.socketId, sender: socketId } );
                pc.push( data.socketId );
                console.log('8')
                init( true, data.socketId );
            } );

            console.log('9')

            //When a new user enters room
            socket.on( 'newUserStart', ( data ) => {
                pc.push( data.sender );
                console.log('10')
                init( false, data.sender );
            } );

            console.log('11')

            socket.on( 'ice candidates', async ( data ) => {
                data.candidate ? await pc[data.sender].addIceCandidate( new RTCIceCandidate( data.candidate ) ) : '';
                console.log('12')
            } );

            console.log('13')

            ///sends across the offer and sets the local description, receives the answer and sets as remote description
            socket.on( 'sdp', async ( data ) => {
                console.log('14')
                if ( data.description.type === 'offer' ) {
                    data.description ? await pc[data.sender].setRemoteDescription( new RTCSessionDescription( data.description ) ) : '';
                    console.log('15')
                    h.getUserFullMedia().then( async ( stream ) => {
                        console.log('16')
                        if ( !document.getElementById( 'local' ).srcObject ) {
                            console.log('17')
                            h.setLocalStream( stream );
                            console.log('18')
                        }

                        console.log('19')

                        //save my stream
                        myStream = stream;
                        console.log('20')

                        stream.getTracks().forEach( ( track ) => {
                            console.log('21')
                            pc[data.sender].addTrack( track, stream );
                            console.log('22')
                        } );
                        

                        console.log('23')

                        let answer = await pc[data.sender].createAnswer();
                        console.log('24')

                        await pc[data.sender].setLocalDescription( answer );
                        console.log('25')

                        socket.emit( 'sdp', { description: pc[data.sender].localDescription, to: data.sender, sender: socketId } );
                        console.log('26')
                    } ).catch( ( e ) => {
                        console.error( e );
                        console.log('27')
                    } );
                }

                else if ( data.description.type === 'answer' ) {
                    console.log('28')
                    await pc[data.sender].setRemoteDescription( new RTCSessionDescription( data.description ) );
                    console.log('29')
                }
            } );

            //whenever a new message arrives
            console.log('30')
            socket.on( 'chat', ( data ) => {
                h.addChat( data, 'remote' );
                console.log('31')
            } );
            console.log('32')
        } );


        function getAndSetUserStream() {
            console.log('33')
            h.getUserFullMedia().then( ( stream ) => {
                console.log('34')
                //save my stream
                myStream = stream;

                h.setLocalStream( stream );
                
                console.log('35')

            } ).catch( ( e ) => {
                console.error( `stream error: ${ e }` );
                console.log('36')
            } );
        }

        //Function to send messages
        function sendMsg( msg ) {
            let data = {
                room: room,
                msg: msg,
                sender: username
            };

            //emit chat message
            socket.emit( 'chat', data );

            //add localchat
            h.addChat( data, 'local' );
        }


        let pcconn ;

        //Creating WebRTC Connection
        function init( createOffer, partnerName ) {
            console.log('37')
            pc[partnerName] = new RTCPeerConnection( h.getIceServer() );
            pcconn = pc[partnerName];
            console.log('38')
            if ( screen && screen.getTracks().length ) {
                screen.getTracks().forEach( ( track ) => {
                    pc[partnerName].addTrack( track, screen );//should trigger negotiationneeded event
                } );
            }

            else if ( myStream ) {
                myStream.getTracks().forEach( ( track ) => {
                    pc[partnerName].addTrack( track, myStream );//should trigger negotiationneeded event
                } );
            }

            else {
                h.getUserFullMedia().then( ( stream ) => {
                    //save my stream
                    myStream = stream;

                    stream.getTracks().forEach( ( track ) => {
                        pc[partnerName].addTrack( track, stream );//should trigger negotiationneeded event
                    } );

                    h.setLocalStream( stream );
                } ).catch( ( e ) => {
                    console.error( `stream error: ${ e }` );
                } );
            }



            //create offer
            if ( createOffer ) {
                console.log('39')
                pc[partnerName].onnegotiationneeded = async () => {
                    let offer = await pc[partnerName].createOffer();
                    console.log('40')
                    await pc[partnerName].setLocalDescription( offer );

                    socket.emit( 'sdp', { description: pc[partnerName].localDescription, to: partnerName, sender: socketId } );
                    console.log('41')
                };
            }
            console.log('42')


            //send ice candidate to partnerNames
            pc[partnerName].onicecandidate = ( { candidate } ) => {
                console.log('43')
                socket.emit( 'ice candidates', { candidate: candidate, to: partnerName, sender: socketId } );
            };

            console.log('44')

            //adding partner's streams
            pc[partnerName].ontrack = ( e ) => {
                
                    console.log('45')
                    let str = e.streams[0];
                    if ( document.getElementById( `${ partnerName }-video` ) ) {
                        console.log('46')
                        document.getElementById( `${ partnerName }-video` ).srcObject = str;
                    }
                    
                    else {
                        //video elem
                        console.log('47')
                        let newVid = document.createElement( 'video' );
                        newVid.id = `${ partnerName }-video`;
                        newVid.srcObject = str;
                        newVid.autoplay = true;
                        newVid.className = 'remote-video';
                        console.log('48')
                        

                        //video controls elements
                        let controlDiv = document.createElement( 'div' );
                        controlDiv.className = 'remote-video-controls';
                        controlDiv.innerHTML = `<i class="fa fa-microphone text-white pr-3 mute-remote-mic" title="Mute"></i>
                            <i class="fa fa-expand text-white expand-remote-video" title="Expand"></i>`;

                        console.log('49')
                        //create a new div for card
                        let cardDiv = document.createElement( 'div' );
                        cardDiv.className = 'card card-sm';
                        cardDiv.id = partnerName;
                        cardDiv.appendChild( newVid );
                        cardDiv.appendChild( controlDiv );

                        console.log('50')
                        //put div in main-section elem
                        document.getElementById( 'videos' ).appendChild( cardDiv );

                        h.adjustVideoElemSize();
                    }
                
            };


            //When the connection state changes
            pc[partnerName].onconnectionstatechange = ( d ) => {
                console.log('51')
                switch ( pc[partnerName].iceConnectionState ) {
                    case 'disconnected':
                    case 'failed':
                        h.closeVideo( partnerName );
                        break;

                    case 'closed':
                        h.closeVideo( partnerName );
                        break;

                    

                }
            };


            //When signalling state changes
            pc[partnerName].onsignalingstatechange = ( d ) => {
                switch ( pc[partnerName].signalingState ) {
                    case 'closed':
                        console.log( "Signalling state is 'closed'" );
                        h.closeVideo( partnerName );
                        break;
                }
            };
        }


        //Function to share screen
        function shareScreen() {
            console.log('52')

            h.shareScreen().then( ( stream ) => {
                h.toggleShareIcons( true );
                console.log('53')

                //disable the video toggle btns while sharing screen. This is to ensure clicking on the btn does not interfere with the screen sharing
                //It will be enabled was user stopped sharing screen
                h.toggleVideoBtnDisabled( true );

                //save my screen stream
                screen = stream;

                //share the new stream with all partners
                broadcastNewTracks( stream, 'video', false );

                //When the stop sharing button shown by the browser is clicked
                screen.getVideoTracks()[0].addEventListener( 'ended', () => {
                    stopSharingScreen();
                    console.log('54')
                } );
            } ).catch( ( e ) => {
                console.error( e );
            } );
        }


        //Function to stop sharing screen
        function stopSharingScreen() {
            //enable video toggle btn
            h.toggleVideoBtnDisabled( false );

            return new Promise( ( res, rej ) => {
                screen.getTracks().length ? screen.getTracks().forEach( track => track.stop() ) : '';

                res();
            } ).then( () => {
                h.toggleShareIcons( false );
                broadcastNewTracks( myStream, 'video' );
            } ).catch( ( e ) => {
                console.error( e );
            } );
        }


        //sends across new tracks when available
        function broadcastNewTracks( stream, type, mirrorMode = true ) {
            console.log('55')
            h.setLocalStream( stream, mirrorMode );

            let track = type == 'audio' ? stream.getAudioTracks()[0] : stream.getVideoTracks()[0];
            console.log('56')
            for ( let p in pc ) {
                let pName = pc[p];
                console.log('57')

                if ( typeof pc[pName] == 'object' ) {
                    console.log('58')
                    h.replaceTrack( track, pc[pName] );
                }
                console.log('59')
            }
            console.log('60')
        }

        //Recording On and Off button
        function toggleRecordingIcons( isRecording ) {
            let e = document.getElementById( 'record' );

            if ( isRecording ) {
                e.setAttribute( 'title', 'Stop recording' );
                e.children[0].classList.add( 'text-danger' );
                e.children[0].classList.remove( 'text-white' );
            }

            else {
                e.setAttribute( 'title', 'Record' );
                e.children[0].classList.add( 'text-white' );
                e.children[0].classList.remove( 'text-danger' );
            }
        }

        //function to start recording
        function startRecording( stream ) {
            mediaRecorder = new MediaRecorder( stream, {
                mimeType: 'video/webm;codecs=vp9'
            } );

            mediaRecorder.start( 1000 );
            toggleRecordingIcons( true );

            mediaRecorder.ondataavailable = function ( e ) {
                recordedStream.push( e.data );
            };

            mediaRecorder.onstop = function () {
                toggleRecordingIcons( false );

                h.saveRecordedStream( recordedStream, username );

                setTimeout( () => {
                    recordedStream = [];
                }, 3000 );
            };

            mediaRecorder.onerror = function ( e ) {
                console.error( e );
            };
        }


        //Chat textarea
        document.getElementById( 'chat-input' ).addEventListener( 'keypress', ( e ) => {
            if ( e.which === 13 && ( e.target.value.trim() ) ) {
                e.preventDefault();

                sendMsg( e.target.value );

                setTimeout( () => {
                    e.target.value = '';
                }, 50 );
            }
        } );


        //When the video icon is clicked
        document.getElementById( 'toggle-video' ).addEventListener( 'click', ( e ) => {
            console.log('61')
            e.preventDefault();

            let elem = document.getElementById( 'toggle-video' );

            if ( myStream.getVideoTracks()[0].enabled ) {
                console.log('62')
                e.target.classList.remove( 'fa-video' );
                e.target.classList.add( 'fa-video-slash' );
                elem.setAttribute( 'title', 'Show Video' );

                myStream.getVideoTracks()[0].enabled = false;
                console.log('63')
            }

            else {
                console.log('64')
                e.target.classList.remove( 'fa-video-slash' );
                e.target.classList.add( 'fa-video' );
                elem.setAttribute( 'title', 'Hide Video' );

                myStream.getVideoTracks()[0].enabled = true;
                console.log('65')
            }
            console.log('66')
            broadcastNewTracks( myStream, 'video' );
            console.log('67')
        } );

        //Work under Progress
        //When start call button is clicked
        
        /*document.getElementById('startcall').addEventListener('click', (e) => {
            
            console.log('68')
            //callstate != callstate;
            startbuttonclick(e)
            
        })*/

        /*function startbuttonclick(e) {
            if (callstate==true) {
                console.log('69')

                endcallstate(e)

                //myStream.getAudioTracks.enabled = false
                //myStream.getVideoTracks.enabled = false
                h.closeVideo[username];
                pcconn.close();
                pcconn = null;
                
                console.log("data channel closed")
            }

            else {
                console.log('70')

                startcallstate(e)

                getAndSetUserStream()

                /*if ( screen && screen.getTracks().length ) {
                    console.log('71')
                    screen.getTracks().forEach( ( track ) => {
                        console.log('72')
                        pcconn.addTrack( track, screen );//should trigger negotiationneeded event
                    } );
                }
    
                else if ( myStream ) {
                    console.log('73')
                    myStream.getTracks().forEach( ( track ) => {
                        console.log('74')
                        pcconn.addTrack( track, myStream );//should trigger negotiationneeded event
                    } );
                }
    
                else {
                    console.log('75')
                    h.getUserFullMedia().then( ( stream ) => {
                        console.log('76')
                        //save my stream
                        myStream = stream;
    
                        stream.getTracks().forEach( ( track ) => {
                            console.log('77')
                            pcconn.addTrack( track, stream );//should trigger negotiationneeded event
                        } );
    
                        h.setLocalStream( stream );
                        console.log('78')
                    } ).catch( ( e ) => {
                        console.error( `stream error: ${ e }` );
                    } );
                }*/
          //  }
        //}

        /*function onstart() {

            myStream.getVideoTracks()[0].enabled = false;
            myStream.getAudioTracks()[0].enabled = false;
        }*/

        

        /*function startcallstate(e) {
            callstate = true
            document.getElementById('toggle-video').attributes.removeNamedItem( 'hidden' );
            document.getElementById('toggle-mute').attributes.removeNamedItem( 'hidden' );
            document.getElementById('share-screen').attributes.removeNamedItem( 'hidden' );
            document.getElementById('record').attributes.removeNamedItem( 'hidden' );
            document.getElementById('local').attributes.removeNamedItem( 'hidden' );
            document.getElementById('videos').attributes.removeNamedItem( 'hidden' );
            //document.getElementById('local').autoplay = true
            //document.getElementById('videos').autoplay = true
            e.target.classList.remove( 'fa-phone' );
            e.target.classList.add( 'fa-phone-slash' );
            document.getElementById('startcall').setAttribute( 'title', 'End Call' );
        }*/

        /*function endcallstate(e) {
            callstate = false
            document.getElementById('toggle-video').setAttribute( 'hidden', true );
            document.getElementById('toggle-mute').setAttribute( 'hidden', true );
            document.getElementById('share-screen').setAttribute( 'hidden', true );
            document.getElementById('record').setAttribute( 'hidden', true );
            document.getElementById('local').setAttribute( 'hidden', true );
            document.getElementById('videos').setAttribute( 'hidden', true );
            //document.getElementById('local').autoplay = false
            //document.getElementById('videos').autoplay = false
            e.target.classList.remove( 'fa-phone-slash' );
            e.target.classList.add( 'fa-phone' );
            document.getElementById('startcall').setAttribute( 'title', 'Start Call' );
        }*/
        


        //When the mute icon is clicked
        document.getElementById( 'toggle-mute' ).addEventListener( 'click', ( e ) => {
            console.log('79')
            e.preventDefault();

            let elem = document.getElementById( 'toggle-mute' );

            if ( myStream.getAudioTracks()[0].enabled ) {
                console.log('80')
                e.target.classList.remove( 'fa-microphone-alt' );
                e.target.classList.add( 'fa-microphone-alt-slash' );
                elem.setAttribute( 'title', 'Unmute' );

                myStream.getAudioTracks()[0].enabled = false;
            }

            else {
                console.log('81')
                e.target.classList.remove( 'fa-microphone-alt-slash' );
                e.target.classList.add( 'fa-microphone-alt' );
                elem.setAttribute( 'title', 'Mute' );

                myStream.getAudioTracks()[0].enabled = true;
            }
            console.log('82')
            broadcastNewTracks( myStream, 'audio' );
        } );


        //When user clicks the 'Share screen' button
        document.getElementById( 'share-screen' ).addEventListener( 'click', ( e ) => {
            e.preventDefault();

            if ( screen && screen.getVideoTracks().length && screen.getVideoTracks()[0].readyState != 'ended' ) {
                stopSharingScreen();
            }

            else {
                shareScreen();
            }
        } );


        //When record button is clicked
        document.getElementById( 'record' ).addEventListener( 'click', ( e ) => {
            /**
             * Ask user what they want to record.
             * Get the stream based on selection and start recording
             */
            if ( !mediaRecorder || mediaRecorder.state == 'inactive' ) {
                h.toggleModal( 'recording-options-modal', true );
            }

            else if ( mediaRecorder.state == 'paused' ) {
                mediaRecorder.resume();
            }

            else if ( mediaRecorder.state == 'recording' ) {
                mediaRecorder.stop();
            }
        } );


        //When user choose to record screen
        document.getElementById( 'record-screen' ).addEventListener( 'click', () => {
            h.toggleModal( 'recording-options-modal', false );

            if ( screen && screen.getVideoTracks().length ) {
                startRecording( screen );
            }

            else {
                h.shareScreen().then( ( screenStream ) => {
                    startRecording( screenStream );
                } ).catch( () => { } );
            }
        } );


        //When user choose to record own video
        document.getElementById( 'record-video' ).addEventListener( 'click', () => {
            h.toggleModal( 'recording-options-modal', false );

            if ( myStream && myStream.getTracks().length ) {
                startRecording( myStream );
            }

            else {
                h.getUserFullMedia().then( ( videoStream ) => {
                    startRecording( videoStream );
                } ).catch( () => { } );
            }
        } );

        //When user chooses to leave
        document.getElementById('leave').addEventListener('click', () => {
            console.log('83')
            myStream.getAudioTracks.enabled = false
            myStream.getVideoTracks.enabled = false
            h.closeVideo[username];
            pc[partnerName].close();
            pc[partnerName] = null;
            
            console.log("data channel closed")
            console.log('84')
            
        })


    }
    console.log('85')
} );
