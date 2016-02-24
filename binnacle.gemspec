# coding: utf-8
lib = File.expand_path('../lib', __FILE__)
$LOAD_PATH.unshift(lib) unless $LOAD_PATH.include?(lib)
require 'binnacle/version'

Gem::Specification.new do |spec|
  spec.name          = "binnacle"
  spec.version       = Binnacle::VERSION
  spec.authors       = ["Brian Sam-Bodden"]
  spec.email         = ["brian@binnacle.com"]
  spec.summary       = %q{ Ruby client for the Binnacle API }
  spec.description   = %q{ Binnacle Distributed Logging and Push Service. See http://binnacle.io }
  spec.homepage      = "http://binnacle.io/api"
  spec.license       = "MIT"

  spec.files         = `git ls-files -z`.split("\x0")
  spec.executables   = spec.files.grep(%r{^bin/}) { |f| File.basename(f) }
  spec.test_files    = spec.files.grep(%r{^(test|spec|features)/})
  spec.require_paths = ["lib"]

  spec.add_runtime_dependency 'httpclient', '~> 2.7', '>= 2.7.1'
  spec.add_runtime_dependency 'faraday', '~> 0.9.2'
  spec.add_runtime_dependency 'faye-websocket', '~> 0.10.2'
  spec.add_runtime_dependency 'trollop', '~> 2.1', '>= 2.1.2'
  spec.add_runtime_dependency 'rack-timeout', '~> 0.3.2'
  spec.add_runtime_dependency 'addressable', '~> 2.3'

  spec.add_development_dependency 'bundler', '~> 1.7'
  spec.add_development_dependency 'rake', '~> 10.0'
  spec.add_development_dependency 'rspec', '~> 3.2', '>= 3.2.0'
  spec.add_development_dependency 'rspec-collection_matchers', '~> 1.1', '>= 1.1.2'
  spec.add_development_dependency 'rspec-wait', '~> 0.0.8'
  spec.add_development_dependency 'codeclimate-test-reporter', '~> 0.4.8'
  spec.add_development_dependency 'simplecov', '~> 0.11.1'
  spec.add_development_dependency 'vcr', '~> 2.9', '>= 2.9.3'
  spec.add_development_dependency 'webmock', '~> 1.22', '>= 1.22.6'
  spec.add_development_dependency 'fivemat', '~> 1.3', '>= 1.3.2'
  spec.add_development_dependency 'rack', '~> 1.6', '>= 1.6.4'

  # For outgoing HTTP logging testing
  spec.add_development_dependency 'httparty', '~> 0.13.7'
  spec.add_development_dependency 'excon', '~> 0.45.4'
  spec.add_development_dependency 'typhoeus', '~> 1.0', '>= 1.0.1'
  spec.add_development_dependency 'ethon', '~> 0.8.1'
  spec.add_development_dependency 'patron', '~> 0.5.0'
  spec.add_development_dependency 'http', '~> 1.0', '>= 1.0.2'
  spec.add_development_dependency 'thin', '~> 1.6', '>= 1.6.4'
end
