import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import * as SIP from 'sip.js';
import { useSelector } from 'react-redux';
import api from '../services/api';

const PhoneContext = createContext();

export const usePhone = () => useContext(PhoneContext);

export const PhoneProvider = ({ children }) => {
    const { user } = useSelector(state => state.auth);
    const [ua, setUa] = useState(null);
    const [status, setStatus] = useState('Disconnected');
    const [activeSession, setActiveSession] = useState(null);
    const [callState, setCallState] = useState('idle'); // idle, calling, active, ended
    const [remoteNumber, setRemoteNumber] = useState('');
    const [isMuted, setIsMuted] = useState(false);
    const [callStartTime, setCallStartTime] = useState(null);
    const [callDirection, setCallDirection] = useState('outbound');
    const [timer, setTimer] = useState(0);
    const [isReceivingCalls, setIsReceivingCallsState] = useState(false);
    const [incomingCall, setIncomingCall] = useState(null);
    const timerIntervalRef = useRef(null);
    const remoteAudioRef = useRef(null);
    const socketRef = useRef(null);

    // Placeholder for re-triggering the useEffect
    const [reinitCounter, setReinitCounter] = useState(0);
    const reinitialize = () => setReinitCounter(prev => prev + 1);

    useEffect(() => {
        if (!user?.sip_user || !user?.sip_password || !user?.wss_url) {
            console.log('[Phone] Missing SIP credentials, skipping initialization');
            return;
        }

        const initializeSip = async () => {
            try {
                // SIP.js 0.20+ uses SimpleUser for WebRTC
                const options = {
                    aor: `sip:${user.sip_user}@${user.sip_domain || 'o2-business-server.com'}`,
                    media: {
                        remote: { audio: remoteAudioRef.current }
                    },
                    userAgentOptions: {
                        displayName: user.name,
                        authorizationUsername: user.sip_user,
                        authorizationPassword: user.sip_password
                    }
                };

                const simpleUser = new SIP.Web.SimpleUser(user.wss_url, options);
                
                simpleUser.delegate = {
                    onCallCreated: () => {
                        console.log('[Phone] Call Created');
                        setCallState('calling');
                    },
                    onCallAnswered: () => {
                        console.log('[Phone] Call Answered');
                        setCallState('active');
                        setCallStartTime(Date.now());
                        setTimer(0);
                        timerIntervalRef.current = setInterval(() => {
                            setTimer(prev => prev + 1);
                        }, 1000);
                    },
                    onCallHangup: () => {
                        console.log('[Phone] Call Hungup');
                        setCallState('ended');
                        
                        // Log the call to database
                        const duration = callStartTime ? Math.round((Date.now() - callStartTime) / 1000) : 0;
                        api.post('/phone/logs', {
                            direction: callDirection,
                            remote_number: remoteNumber,
                            duration_seconds: duration,
                            status: 'completed'
                        }).catch(err => console.error('[Phone] Failed to log call:', err));

                        // Clear timer
                        if (timerIntervalRef.current) {
                            clearInterval(timerIntervalRef.current);
                            timerIntervalRef.current = null;
                        }

                        setTimeout(() => {
                            setCallState('idle');
                            setActiveSession(null);
                            setCallStartTime(null);
                            setTimer(0);
                        }, 2000);
                    }
                };

                // Handle Inbound Call Reception
                simpleUser.delegate.onCallReceived = (session) => {
                    if (!isReceivingCalls) {
                        console.log('[Phone] Inbound call rejected (Reception OFF)');
                        session.reject();
                        return;
                    }
                    
                    console.log('[Phone] Inbound call received from:', session.remoteIdentity.uri.user);
                    setIncomingCall({
                        session,
                        remoteNumber: session.remoteIdentity.uri.user,
                        displayName: session.remoteIdentity.displayName || 'Unbekannt'
                    });
                };

                await simpleUser.connect();
                setUa(simpleUser);
                setStatus('Connected');
                console.log('[Phone] SIP Connected');

            } catch (err) {
                console.error('[Phone] Failed to connect SIP:', err);
                setStatus('Error');
            }
        };

        initializeSip();

        // Socket logic for real-time status sync
        import('../services/socket').then(module => {
            const socketService = module.default;
            socketService.on('PHONE_STATUS_CHANGED', (data) => {
                setIsReceivingCallsState(data.is_receiving_calls);
            });
        });

        // Initialize state from backend only for internal employees, not for subcontractors
        const isSubcontractor = user?.role === 'Subcontractor' || user?.role?.name === 'Subcontractor';
        if (user && !isSubcontractor) {
            api.get('/phone/settings').then(res => {
                if (res.data.status === 'success') {
                    setIsReceivingCallsState(res.data.data.is_receiving_calls);
                }
            }).catch(err => console.error('[Phone] Failed to fetch reception status:', err));
        }

        return () => {
            if (ua) {
                ua.disconnect();
            }
        };
    }, [user, reinitCounter, isReceivingCalls]); // Added isReceivingCalls to dependencies to re-bind delegate

    const makeCall = async (number) => {
        if (!ua) return;
        setRemoteNumber(number);
        setCallDirection('outbound');
        setCallState('calling');
        try {
            await ua.call(`sip:${number}@${user.sip_domain || 'o2-business-server.com'}`);
        } catch (err) {
            console.error('[Phone] Call failed:', err);
            setCallState('idle');
        }
    };

    const hangup = () => {
        if (ua) {
            ua.hangup();
        }
    };

    const toggleMute = () => {
        if (ua) {
            if (isMuted) {
                ua.unmute();
            } else {
                ua.mute();
            }
            setIsMuted(!isMuted);
        }
    };


    const setIsReceivingCalls = async (value) => {
        try {
            await api.patch('/phone/status', { is_receiving_calls: value });
            setIsReceivingCallsState(value);
        } catch (err) {
            console.error('[Phone] Failed to update reception status:', err);
        }
    };

    const answerCall = async () => {
        if (!incomingCall) return;
        try {
            await incomingCall.session.answer();
            setCallDirection('inbound');
            setRemoteNumber(incomingCall.remoteNumber);
            setCallState('active');
            setIncomingCall(null);
        } catch (err) {
            console.error('[Phone] Failed to answer call:', err);
        }
    };

    const rejectCall = async () => {
        if (!incomingCall) return;
        try {
            await incomingCall.session.reject();
            setIncomingCall(null);
        } catch (err) {
            console.error('[Phone] Failed to reject call:', err);
        }
    };

    const value = {
        status,
        callState,
        remoteNumber,
        isMuted,
        isReceivingCalls,
        setIsReceivingCalls,
        incomingCall,
        answerCall,
        rejectCall,
        makeCall,
        hangup,
        toggleMute,
        reinitialize,
        timer,
        remoteAudioRef
    };

    return (
        <PhoneContext.Provider value={value}>
            {children}
            {/* Hidden audio element for remote stream */}
            <audio ref={remoteAudioRef} autoPlay hidden />
        </PhoneContext.Provider>
    );
};
