def notify = [
    email: false,
    slack: [ success: '#bengal-canyon-build', failure: '#bengal-canyon-build' ]
]

def projectKey = 'rcs-microservice'

node {
    try {
        stage('Cloning Repository') {
            scmCheckout {
                clean = true
            }
        }

        // if we are on the master branch run static code scans
        // if(env.GIT_BRANCH =~ /.*master/) {
            stage('Static Code Scan') {
                staticCodeScan {
                    // generic
                    scanners             = ['checkmarx', 'protex', 'snyk']
                    scannerType          = 'javascript'

                    protexProjectName    = 'Bengal Canyon'
                    // internal, do not change
                    protexBuildName      = 'rrs-generic-protex-build'

                    checkmarxProjectName = "RSD-Danger-Bay-RCS-MicroService"

                    //snyk details
                    snykUrl                 = 'https://snyk.devtools.intel.com/api'
                    snykManifestFile        = ['package-lock.json']
                    snykProjectName         = ['bengal-canyon-rcs']
                    snykScanApiToken        = 'snyk_apitoken_sys_rsdcodescan'
                }
            }
        // }

        stage('Test') {
            docker.image('node:latest').inside('-e http_proxy -e https_proxy') {
                    sh 'npm install'
                    sh 'npm run test'
            }
        }

        stage('Build') {
            docker.image('node:latest').inside('-e http_proxy -e https_proxy') {
                sh 'npm install'
                sh 'npm build'
             }
        }

        // If we are building a docker image
        dockerBuild {
            dockerImageName         =  "${projectKey}"
            dockerRegistry          = 'amr-registry.caas.intel.com/danger-bay'
        }

        if(notify.email) {
            def buildResult = currentBuild.result ?: 'SUCCESS'
            mail to: notify.email.to, subject: "[${buildResult}] 🙌 ✅ - ${env.JOB_NAME} - Build # ${env.BUILD_NUMBER} 🙌 ✅", body: "${env.BUILD_URL}"
        }

        if(notify.slack) {
            slackBuildNotify {
                slackSuccessChannel = notify.slack.success
            }
        }
    } catch (ex) {
        currentBuild.result = 'FAILURE'

        if(notify.email) {
            mail to: notify.email.to, subject: "[${currentBuild.result}] 💩 😵 - ${env.JOB_NAME} - Build # ${env.BUILD_NUMBER} 👻 😭", body: "${env.BUILD_URL}"
        }

        if(notify.slack) {
            slackBuildNotify {
                failed = true
                slackFailureChannel = notify.slack.failure
                messages = [
                    [ title: 'An Error Occured', text: "The build failed due to: ${ex.getMessage()}" ]
                ]
            }
        }

        throw ex
    }
}
