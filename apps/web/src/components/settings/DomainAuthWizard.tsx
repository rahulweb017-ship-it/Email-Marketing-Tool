import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Copy, CheckCircle, XCircle, Loader2, Shield, ChevronRight, RotateCcw } from 'lucide-react'
import clsx from 'clsx'
import Modal from '../ui/Modal'
import { useToastStore } from '../../stores/toast.store'
import api from '../../api/client'

interface DomainAuthWizardProps {
  isOpen: boolean
  onClose: () => void
  configId: string
  configName: string
}

interface DnsRecord {
  type: string
  host: string
  value: string
  description: string
  selector?: string
}

interface DomainRecords {
  domain: string
  provider: string
  spf: DnsRecord
  dkim: DnsRecord
  dmarc: DnsRecord
}

interface VerifyResult {
  found: boolean
  valid: boolean
  records: string[]
  selector?: string
}

interface VerifyResponse {
  domain: string
  spf: VerifyResult
  dkim: VerifyResult
  dmarc: VerifyResult
}

type RecordType = 'spf' | 'dkim' | 'dmarc'

const STEPS: { key: RecordType; label: string; title: string }[] = [
  { key: 'spf', label: 'SPF', title: 'Sender Policy Framework (SPF)' },
  { key: 'dkim', label: 'DKIM', title: 'DomainKeys Identified Mail (DKIM)' },
  { key: 'dmarc', label: 'DMARC', title: 'Domain-based Message Authentication' },
]

const descriptions: Record<RecordType, string> = {
  spf: 'SPF tells receiving mail servers which IP addresses and services are authorized to send email on behalf of your domain. This helps prevent email spoofing.',
  dkim: 'DKIM adds a digital signature to your outgoing emails, allowing receivers to verify the message was not altered in transit and truly came from your domain.',
  dmarc: 'DMARC builds on SPF and DKIM to give domain owners control over what happens when authentication fails. It also provides reporting on authentication results.',
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
      const textarea = document.createElement('textarea')
      textarea.value = text
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <button
      onClick={handleCopy}
      className={clsx(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors',
        copied ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
      )}
    >
      {copied ? <CheckCircle className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

function StepIndicator({ currentStep, verifyResults }: { currentStep: number; verifyResults: Record<RecordType, VerifyResult | null> }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {STEPS.map((step, i) => {
        const result = verifyResults[step.key]
        const isActive = i === currentStep
        const isPassed = result?.found && result?.valid

        return (
          <div key={step.key} className="flex items-center">
            {i > 0 && <div className={clsx('w-8 h-0.5 mx-1', isPassed ? 'bg-green-400' : 'bg-gray-200')} />}
            <div
              className={clsx(
                'flex items-center justify-center w-8 h-8 rounded-full text-xs font-medium transition-colors',
                isPassed ? 'bg-green-500 text-white' :
                isActive ? 'bg-primary-600 text-white' :
                'bg-gray-200 text-gray-500',
              )}
            >
              {isPassed ? <CheckCircle className="h-4 w-4" /> : i + 1}
            </div>
            <span className={clsx('ml-1.5 text-sm', isActive ? 'font-medium text-gray-900' : 'text-gray-500')}>
              {step.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export default function DomainAuthWizard({ isOpen, onClose, configId, configName }: DomainAuthWizardProps) {
  const addToast = useToastStore((s) => s.addToast)
  const [currentStep, setCurrentStep] = useState(0)
  const [records, setRecords] = useState<DomainRecords | null>(null)
  const [loadingRecords, setLoadingRecords] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [verifyResults, setVerifyResults] = useState<Record<RecordType, VerifyResult | null>>({
    spf: null,
    dkim: null,
    dmarc: null,
  })
  const [allPassed, setAllPassed] = useState(false)

  const fetchRecords = useCallback(async () => {
    setLoadingRecords(true)
    try {
      const { data } = await api.get(`/sending-configs/${configId}/domain-records`)
      setRecords(data)
    } catch {
      addToast('Failed to load domain records', 'error')
    } finally {
      setLoadingRecords(false)
    }
  }, [configId, addToast])

  useEffect(() => {
    if (isOpen && configId) {
      setCurrentStep(0)
      setVerifyResults({ spf: null, dkim: null, dmarc: null })
      setAllPassed(false)
      fetchRecords()
    }
  }, [isOpen, configId, fetchRecords])

  const handleVerify = async () => {
    setVerifying(true)
    try {
      const { data } = await api.post<VerifyResponse>(`/sending-configs/${configId}/verify-domain`)
      const newResults = {
        spf: data.spf,
        dkim: data.dkim,
        dmarc: data.dmarc,
      }
      setVerifyResults(newResults)

      const stepKey = STEPS[currentStep].key
      const result = newResults[stepKey]

      if (result?.found && result?.valid) {
        addToast(`${STEPS[currentStep].label} verified successfully`, 'success')

        // Check if all three pass
        const allPass = Object.values(newResults).every((r) => r?.found && r?.valid)
        if (allPass) {
          setAllPassed(true)
        } else if (currentStep < STEPS.length - 1) {
          // Auto-advance to next step after a brief delay
          setTimeout(() => setCurrentStep((s) => s + 1), 800)
        }
      } else {
        addToast(`${STEPS[currentStep].label} verification failed — check your DNS records`, 'warning')
      }
    } catch {
      addToast('Verification failed — please try again', 'error')
    } finally {
      setVerifying(false)
    }
  }

  const handleReset = () => {
    setCurrentStep(0)
    setVerifyResults({ spf: null, dkim: null, dmarc: null })
    setAllPassed(false)
  }

  const stepKey = STEPS[currentStep]?.key
  const currentRecord = records ? records[stepKey] : null
  const currentResult = verifyResults[stepKey]

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Domain Authentication — ${configName}`}
      size="lg"
      footer={
        !allPassed ? (
          <div className="flex justify-between">
            <button
              onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
              disabled={currentStep === 0}
              className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Back
            </button>
            <div className="flex gap-2">
              {currentStep < STEPS.length - 1 && (
                <button
                  onClick={() => setCurrentStep((s) => s + 1)}
                  className="flex items-center gap-1 px-4 py-2 border rounded-lg text-sm hover:bg-gray-50"
                >
                  Skip <ChevronRight className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={handleVerify}
                disabled={verifying || loadingRecords}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm disabled:opacity-50"
              >
                {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                Verify {STEPS[currentStep]?.label}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex justify-between">
            <button onClick={handleReset} className="flex items-center gap-1.5 px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">
              <RotateCcw className="h-4 w-4" /> Re-check
            </button>
            <button onClick={onClose} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm">
              Done
            </button>
          </div>
        )
      }
    >
      {loadingRecords ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
        </div>
      ) : !records ? (
        <div className="text-center py-12 text-gray-500">
          <p>Could not load DNS records for this configuration.</p>
          <p className="text-sm mt-1">Ensure the provider has a domain or from_email configured.</p>
        </div>
      ) : allPassed ? (
        /* Success State */
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center py-8"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="mx-auto w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-4"
          >
            <CheckCircle className="h-10 w-10 text-green-600" />
          </motion.div>
          <h3 className="text-xl font-semibold text-green-700 mb-2">All Records Verified</h3>
          <p className="text-gray-500 max-w-md mx-auto">
            Your domain <strong>{records.domain}</strong> is fully authenticated.
            SPF, DKIM, and DMARC are all correctly configured.
          </p>
          <div className="flex justify-center gap-4 mt-6">
            {STEPS.map((step) => (
              <div key={step.key} className="flex items-center gap-1.5 text-sm text-green-600">
                <CheckCircle className="h-4 w-4" /> {step.label}
              </div>
            ))}
          </div>
        </motion.div>
      ) : (
        /* Step Content */
        <div>
          <StepIndicator currentStep={currentStep} verifyResults={verifyResults} />

          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
            >
              <div className="mb-4">
                <h3 className="text-base font-semibold mb-1">{STEPS[currentStep]?.title}</h3>
                <p className="text-sm text-gray-500">{descriptions[stepKey]}</p>
              </div>

              <p className="text-sm text-gray-600 mb-2">
                Add the following DNS record to your domain <strong>{records.domain}</strong>:
              </p>

              {currentRecord && (
                <div className="bg-gray-50 rounded-lg p-4 space-y-3 mb-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1 min-w-0">
                      <div>
                        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Type</span>
                        <p className="text-sm font-mono font-medium">{currentRecord.type}</p>
                      </div>
                      <div>
                        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Host / Name</span>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-mono break-all">{currentRecord.host}</p>
                          <CopyButton text={currentRecord.host} />
                        </div>
                      </div>
                      <div>
                        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Value</span>
                        <div className="flex items-start gap-2">
                          <p className="text-sm font-mono break-all flex-1">{currentRecord.value}</p>
                          <CopyButton text={currentRecord.value} />
                        </div>
                      </div>
                    </div>
                  </div>
                  {currentRecord.description && (
                    <p className="text-xs text-gray-500 border-t pt-2">{currentRecord.description}</p>
                  )}
                </div>
              )}

              {/* Verification Result */}
              <AnimatePresence>
                {currentResult && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className={clsx(
                      'rounded-lg p-4 mb-2',
                      currentResult.found && currentResult.valid
                        ? 'bg-green-50 border border-green-200'
                        : 'bg-red-50 border border-red-200',
                    )}>
                      <div className="flex items-start gap-3">
                        {currentResult.found && currentResult.valid ? (
                          <CheckCircle className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className={clsx(
                            'text-sm font-medium',
                            currentResult.found && currentResult.valid ? 'text-green-700' : 'text-red-700',
                          )}>
                            {currentResult.found && currentResult.valid
                              ? `${STEPS[currentStep].label} record verified successfully`
                              : !currentResult.found
                                ? `No ${STEPS[currentStep].label} record found`
                                : `${STEPS[currentStep].label} record found but may not be configured correctly`}
                          </p>
                          {currentResult.records.length > 0 && (
                            <div className="mt-2">
                              <p className="text-xs text-gray-500 mb-1">Found records:</p>
                              {currentResult.records.map((r, i) => (
                                <p key={i} className="text-xs font-mono text-gray-600 break-all">{r}</p>
                              ))}
                            </div>
                          )}
                          {!currentResult.found && (
                            <p className="text-xs text-red-600 mt-1">
                              DNS changes can take up to 48 hours to propagate. Please add the record and try again later.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-4">
                <p className="text-xs text-amber-700">
                  <strong>Note:</strong> DNS changes may take anywhere from a few minutes to 48 hours to propagate.
                  If verification fails, wait a bit and try again.
                </p>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      )}
    </Modal>
  )
}
